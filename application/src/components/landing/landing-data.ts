/**
 * Landing data access — every number and card on the marketing page is read
 * from Postgres here. There is deliberately NO fallback/demo constant: if a
 * query returns nothing the section renders its empty state, and if a query
 * throws it renders its error state. (PRODUCT_MINDSET §"Dữ liệu thực".)
 *
 * Each loader returns `null` to mean "the query failed" and an empty
 * array / zeroed struct to mean "there is genuinely nothing yet", so callers
 * can tell an outage apart from a fresh install.
 */
import { and, eq, inArray, asc, sql as dsql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { workspaces, roadmapTreeNodes, badges } from '@/lib/db/schema';

export type FeaturedRoadmap = {
  slug: string;
  title: string;
  icon: string | null;
};

export type ShowcaseEntry = FeaturedRoadmap & {
  id: string;
  nodeCount: number;
  phaseCount: number;
};

export type LandingStats = {
  /** Workspaces with visibility = public-readonly. */
  roadmaps: number;
  /** Tree nodes living inside those workspaces. */
  nodes: number;
  /** Deepest tree level in use, expressed as a 1-based level count. */
  levels: number;
  /** Badge definitions those workspaces ship. */
  badges: number;
};

export type BadgeEntry = {
  slug: string;
  title: string;
  desc: string | null;
  /** Lucide icon name stored on the row (e.g. `Flame`). */
  icon: string | null;
};

/** ids of every public-readonly workspace; `[]` when none are published. */
async function publicWorkspaceIds(): Promise<string[]> {
  const rows = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.visibility, 'public-readonly'));
  return rows.map((r) => r.id);
}

/**
 * The roadmap the hero/CTA "see a live example" buttons point at — the first
 * public workspace alphabetically. `null` when nothing is published yet, in
 * which case callers should fall back to /discover rather than a fake slug.
 */
export async function getFeaturedRoadmap(): Promise<FeaturedRoadmap | null> {
  try {
    const rows = await db
      .select({
        slug: workspaces.slug,
        title: workspaces.name,
        icon: workspaces.icon,
      })
      .from(workspaces)
      .where(eq(workspaces.visibility, 'public-readonly'))
      .orderBy(asc(workspaces.name))
      .limit(1);
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

/** Aggregate counters for the hero strip. `null` on query failure. */
export async function getLandingStats(): Promise<LandingStats | null> {
  try {
    const ids = await publicWorkspaceIds();
    if (ids.length === 0) {
      return { roadmaps: 0, nodes: 0, levels: 0, badges: 0 };
    }

    const [nodeAgg] = await db
      .select({
        total: dsql<number>`count(*)::int`,
        maxDepth: dsql<number>`coalesce(max(${roadmapTreeNodes.depth}), 0)::int`,
      })
      .from(roadmapTreeNodes)
      .where(inArray(roadmapTreeNodes.workspaceId, ids));

    const [badgeAgg] = await db
      .select({ total: dsql<number>`count(*)::int` })
      .from(badges)
      .where(inArray(badges.workspaceId, ids));

    const nodes = Number(nodeAgg?.total ?? 0);

    return {
      roadmaps: ids.length,
      nodes,
      // depth is 0-based in the tree; a root-only tree is still one level,
      // and an empty tree has none.
      levels: nodes === 0 ? 0 : Number(nodeAgg?.maxDepth ?? 0) + 1,
      badges: Number(badgeAgg?.total ?? 0),
    };
  } catch {
    return null;
  }
}

/**
 * Public roadmaps with structural counts. Two grouped queries, no N+1:
 * one for total nodes per workspace, one for the top-level phase count
 * (children of the single root, or the root count when the tree is a forest).
 */
export async function getShowcase(): Promise<ShowcaseEntry[] | null> {
  try {
    const rows = await db
      .select({
        id: workspaces.id,
        slug: workspaces.slug,
        title: workspaces.name,
        icon: workspaces.icon,
      })
      .from(workspaces)
      .where(eq(workspaces.visibility, 'public-readonly'))
      .orderBy(asc(workspaces.name));

    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);

    const totals = await db
      .select({
        workspaceId: roadmapTreeNodes.workspaceId,
        n: dsql<number>`count(*)::int`,
      })
      .from(roadmapTreeNodes)
      .where(inArray(roadmapTreeNodes.workspaceId, ids))
      .groupBy(roadmapTreeNodes.workspaceId);
    const totalByWs = new Map(totals.map((t) => [t.workspaceId, Number(t.n)]));

    // depth 1 == direct children of the root == the "phase" row of the tree.
    const phases = await db
      .select({
        workspaceId: roadmapTreeNodes.workspaceId,
        n: dsql<number>`count(*)::int`,
      })
      .from(roadmapTreeNodes)
      .where(
        and(
          inArray(roadmapTreeNodes.workspaceId, ids),
          eq(roadmapTreeNodes.depth, 1),
        ),
      )
      .groupBy(roadmapTreeNodes.workspaceId);
    const phaseByWs = new Map(phases.map((p) => [p.workspaceId, Number(p.n)]));

    return rows.map((r) => ({
      ...r,
      nodeCount: totalByWs.get(r.id) ?? 0,
      phaseCount: phaseByWs.get(r.id) ?? 0,
    }));
  } catch {
    return null;
  }
}

/**
 * Badge definitions published by public workspaces — the motivation section
 * shows the real rules a workspace ships, not an invented trophy shelf.
 */
export async function getPublicBadges(limit = 10): Promise<BadgeEntry[] | null> {
  try {
    const ids = await publicWorkspaceIds();
    if (ids.length === 0) return [];
    return await db
      .select({
        slug: badges.slug,
        title: badges.name,
        desc: badges.description,
        icon: badges.icon,
      })
      .from(badges)
      .where(inArray(badges.workspaceId, ids))
      .orderBy(asc(badges.name))
      .limit(limit);
  } catch {
    return null;
  }
}
