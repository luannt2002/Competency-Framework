/**
 * Server-side tree query helpers.
 * Aggregates children counts, done counts, and derived status per node.
 *
 * Tree-first navigation: each page calls one of these to get either
 *   - list of root nodes (Dashboard)
 *   - one node + its direct children (NodeDetail)
 */
import { and, eq, asc, sql as dsql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { roadmapTreeNodes, userNodeProgress } from '@/lib/db/schema';

export type NodeRow = {
  id: string;
  parentId: string | null;
  nodeType: string;
  title: string;
  slug: string;
  description: string | null;
  bodyMd: string | null;
  orderIndex: number;
  estMinutes: number | null;
  meta: Record<string, unknown>;
  pathStr: string;
  depth: number;
};

export type NodeWithStats = NodeRow & {
  childrenCount: number;
  doneChildren: number;
  status: 'todo' | 'in_progress' | 'done';
};

/** All root nodes in a workspace, with progress + immediate child counts. */
export async function getRootNodes(workspaceId: string, userId: string | null): Promise<NodeWithStats[]> {
  const rows = await db
    .select()
    .from(roadmapTreeNodes)
    .where(
      and(
        eq(roadmapTreeNodes.workspaceId, workspaceId),
        dsql`${roadmapTreeNodes.parentId} IS NULL`,
      ),
    )
    .orderBy(asc(roadmapTreeNodes.orderIndex));
  return enrichWithStats(rows.map(asNodeRow), workspaceId, userId);
}

/** Fetch a single node by its slug + its direct children. */
export async function getNodeBySlug(
  workspaceId: string,
  userId: string | null,
  slug: string,
): Promise<{ node: NodeWithStats; children: NodeWithStats[]; ancestors: NodeRow[] } | null> {
  const found = await db
    .select()
    .from(roadmapTreeNodes)
    .where(and(eq(roadmapTreeNodes.workspaceId, workspaceId), eq(roadmapTreeNodes.slug, slug)))
    .limit(1);
  if (!found[0]) return null;
  const me = asNodeRow(found[0]);

  // Ancestors (in pathStr order)
  const ancestorIds = me.pathStr.split('/').filter(Boolean);
  const ancestors: NodeRow[] = [];
  if (ancestorIds.length > 0) {
    const aRows = await db
      .select()
      .from(roadmapTreeNodes)
      .where(
        and(
          eq(roadmapTreeNodes.workspaceId, workspaceId),
          dsql`${roadmapTreeNodes.id} IN (${dsql.join(ancestorIds.map((id) => dsql`${id}::uuid`), dsql`, `)})`,
        ),
      );
    // Preserve pathStr order
    const aById = new Map(aRows.map((r) => [r.id, asNodeRow(r)]));
    for (const aid of ancestorIds) {
      const a = aById.get(aid);
      if (a) ancestors.push(a);
    }
  }

  const childrenRows = await db
    .select()
    .from(roadmapTreeNodes)
    .where(
      and(eq(roadmapTreeNodes.workspaceId, workspaceId), eq(roadmapTreeNodes.parentId, me.id)),
    )
    .orderBy(asc(roadmapTreeNodes.orderIndex));

  const [enrichedMe, enrichedChildren] = await Promise.all([
    enrichWithStats([me], workspaceId, userId),
    enrichWithStats(childrenRows.map(asNodeRow), workspaceId, userId),
  ]);

  return { node: enrichedMe[0]!, children: enrichedChildren, ancestors };
}

/**
 * Fetch the children of `parentId` (or roots if null) PLUS each child's own children.
 * Returns an array of "sections", each `{ main, subs }`, where `main` is enriched
 * with stats and `subs` is its direct children (enriched).
 *
 * Used by the vertical-roadmap dashboard / node-detail views that render a
 * 2-level overview (phase pill + week sub-pills) per section.
 */
export async function getTreeSections(
  workspaceId: string,
  userId: string | null,
  parentId: string | null,
): Promise<{ main: NodeWithStats; subs: NodeWithStats[] }[]> {
  const mainsRaw = await db
    .select()
    .from(roadmapTreeNodes)
    .where(
      and(
        eq(roadmapTreeNodes.workspaceId, workspaceId),
        parentId === null
          ? dsql`${roadmapTreeNodes.parentId} IS NULL`
          : eq(roadmapTreeNodes.parentId, parentId),
      ),
    )
    .orderBy(asc(roadmapTreeNodes.orderIndex));

  if (mainsRaw.length === 0) return [];
  const mains = mainsRaw.map(asNodeRow);
  const mainIds = mains.map((m) => m.id);

  // All direct children of all mains in one query
  const subsRaw = await db
    .select()
    .from(roadmapTreeNodes)
    .where(
      and(
        eq(roadmapTreeNodes.workspaceId, workspaceId),
        dsql`${roadmapTreeNodes.parentId} IN (${dsql.join(mainIds.map((i) => dsql`${i}::uuid`), dsql`, `)})`,
      ),
    )
    .orderBy(asc(roadmapTreeNodes.orderIndex));

  const subsByParent = new Map<string, NodeRow[]>();
  for (const r of subsRaw) {
    const pid = r.parentId!;
    if (!subsByParent.has(pid)) subsByParent.set(pid, []);
    subsByParent.get(pid)!.push(asNodeRow(r));
  }

  const allNodes = [...mains, ...subsRaw.map(asNodeRow)];
  const enriched = await enrichWithStats(allNodes, workspaceId, userId);
  const enrichedById = new Map(enriched.map((n) => [n.id, n]));

  return mains.map((m) => ({
    main: enrichedById.get(m.id)!,
    subs: (subsByParent.get(m.id) ?? []).map((s) => enrichedById.get(s.id)!).filter(Boolean),
  }));
}

/** Add childrenCount, doneChildren, status per node.
 *  When `userId` is null, returns childrenCount but skips progress joins —
 *  all status defaults to 'todo' and doneChildren = 0. */
async function enrichWithStats(
  nodes: NodeRow[],
  workspaceId: string,
  userId: string | null,
): Promise<NodeWithStats[]> {
  if (nodes.length === 0) return [];

  // Get direct children counts per node (one round-trip)
  const ids = nodes.map((n) => n.id);
  const childCountRows = await db
    .select({
      parentId: roadmapTreeNodes.parentId,
      count: dsql<number>`count(*)::int`,
    })
    .from(roadmapTreeNodes)
    .where(
      and(
        eq(roadmapTreeNodes.workspaceId, workspaceId),
        dsql`${roadmapTreeNodes.parentId} IN (${dsql.join(ids.map((i) => dsql`${i}::uuid`), dsql`, `)})`,
      ),
    )
    .groupBy(roadmapTreeNodes.parentId);
  const childCountMap = new Map(childCountRows.map((r) => [r.parentId, Number(r.count) || 0]));

  // If no user context, skip the user-progress joins entirely.
  const doneByParent = new Map<string, number>();
  const statusMap = new Map<string, string>();

  if (userId) {
    // Per-node descendant done counts
    for (const node of nodes) {
      const childIds = (
        await db
          .select({ id: roadmapTreeNodes.id })
          .from(roadmapTreeNodes)
          .where(
            and(eq(roadmapTreeNodes.workspaceId, workspaceId), eq(roadmapTreeNodes.parentId, node.id)),
          )
      ).map((r) => r.id);
      if (childIds.length === 0) {
        doneByParent.set(node.id, 0);
        continue;
      }
      const doneRows = await db
        .select({ id: userNodeProgress.id })
        .from(userNodeProgress)
        .where(
          and(
            eq(userNodeProgress.workspaceId, workspaceId),
            eq(userNodeProgress.userId, userId),
            eq(userNodeProgress.status, 'done'),
            dsql`${userNodeProgress.nodeId} IN (${dsql.join(childIds.map((i) => dsql`${i}::uuid`), dsql`, `)})`,
          ),
        );
      doneByParent.set(node.id, doneRows.length);
    }

    const ownStatusRows = await db
      .select({ nodeId: userNodeProgress.nodeId, status: userNodeProgress.status })
      .from(userNodeProgress)
      .where(
        and(
          eq(userNodeProgress.workspaceId, workspaceId),
          eq(userNodeProgress.userId, userId),
          dsql`${userNodeProgress.nodeId} IN (${dsql.join(ids.map((i) => dsql`${i}::uuid`), dsql`, `)})`,
        ),
      );
    for (const r of ownStatusRows) {
      statusMap.set(r.nodeId, r.status ?? 'todo');
    }
  }

  return nodes.map<NodeWithStats>((n) => {
    const childCount = childCountMap.get(n.id) ?? 0;
    const doneCount = doneByParent.get(n.id) ?? 0;
    const own = statusMap.get(n.id);
    let status: 'todo' | 'in_progress' | 'done';
    if (own === 'done') status = 'done';
    else if (doneCount > 0 || own === 'doing') status = 'in_progress';
    else status = 'todo';
    return {
      ...n,
      childrenCount: childCount,
      doneChildren: doneCount,
      status,
    };
  });
}

function asNodeRow(r: typeof roadmapTreeNodes.$inferSelect): NodeRow {
  return {
    id: r.id,
    parentId: r.parentId,
    nodeType: r.nodeType,
    title: r.title,
    slug: r.slug,
    description: r.description,
    bodyMd: r.bodyMd,
    orderIndex: r.orderIndex,
    estMinutes: r.estMinutes,
    meta: (r.meta as Record<string, unknown>) ?? {},
    pathStr: r.pathStr,
    depth: r.depth,
  };
}
