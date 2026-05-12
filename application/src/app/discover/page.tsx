/**
 * Public discover page — lists every workspace whose visibility is
 * `public-readonly`. No auth required.
 *
 * Renders a hero, a client-side search filter, and a grid of workspace cards
 * with structural counts (phases = top-level children of the single root,
 * total nodes = whole tree). Each card links to `/share/<slug>`.
 *
 * Stats strategy:
 *   - totalNodes: simple COUNT(*) over roadmap_tree_nodes per workspace.
 *   - totalPhases: number of nodes whose parent IS the workspace's single
 *     root node (the canonical shape in this app). If a workspace has 0 or
 *     >1 roots, totalPhases falls back to the root-count itself — those roots
 *     ARE the top-level phases.
 *
 * All three numbers are computed in two grouped SQL queries (no N+1).
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { and, eq, inArray, isNull, sql as dsql } from 'drizzle-orm';
import { Sparkles } from 'lucide-react';
import { db } from '@/lib/db/client';
import { workspaces, roadmapTreeNodes } from '@/lib/db/schema';
import {
  DiscoverGrid,
  type DiscoverWorkspace,
} from '@/components/discover/discover-grid';
import { Badge } from '@/components/ui/badge';

export const metadata: Metadata = {
  title: 'Khám phá lộ trình công khai · Competency Framework',
  description:
    'Khám phá các lộ trình học tập công khai do cộng đồng chia sẻ — đọc roadmap, lấy cảm hứng cho hành trình của bạn.',
};

export const dynamic = 'force-dynamic';

export default async function DiscoverPage() {
  // 1) Fetch public workspaces.
  const wsRows = await db
    .select({
      id: workspaces.id,
      slug: workspaces.slug,
      name: workspaces.name,
      ownerUserId: workspaces.ownerUserId,
    })
    .from(workspaces)
    .where(eq(workspaces.visibility, 'public-readonly'));

  let cards: DiscoverWorkspace[] = [];

  if (wsRows.length > 0) {
    const ids = wsRows.map((w) => w.id);

    // 2) Total node count per workspace (one aggregate query).
    const totalCountRows = await db
      .select({
        workspaceId: roadmapTreeNodes.workspaceId,
        n: dsql<number>`count(*)::int`,
      })
      .from(roadmapTreeNodes)
      .where(inArray(roadmapTreeNodes.workspaceId, ids))
      .groupBy(roadmapTreeNodes.workspaceId);
    const totalByWs = new Map<string, number>(
      totalCountRows.map((r) => [r.workspaceId, Number(r.n)]),
    );

    // 3) Roots per workspace — for the single-root case we treat phases as
    //    "direct children of that root"; for the multi-root case, the roots
    //    ARE the top-level phases.
    const rootRows = await db
      .select({
        id: roadmapTreeNodes.id,
        workspaceId: roadmapTreeNodes.workspaceId,
      })
      .from(roadmapTreeNodes)
      .where(
        and(
          inArray(roadmapTreeNodes.workspaceId, ids),
          isNull(roadmapTreeNodes.parentId),
        ),
      );
    const rootsByWs = new Map<string, string[]>();
    for (const r of rootRows) {
      const arr = rootsByWs.get(r.workspaceId) ?? [];
      arr.push(r.id);
      rootsByWs.set(r.workspaceId, arr);
    }

    // 4) For workspaces with exactly one root, count its direct children.
    const singleRootIds: string[] = [];
    for (const [, roots] of rootsByWs) {
      if (roots.length === 1) singleRootIds.push(roots[0]!);
    }
    const childCounts = new Map<string, number>();
    if (singleRootIds.length > 0) {
      const childRows = await db
        .select({
          parentId: roadmapTreeNodes.parentId,
          n: dsql<number>`count(*)::int`,
        })
        .from(roadmapTreeNodes)
        .where(inArray(roadmapTreeNodes.parentId, singleRootIds))
        .groupBy(roadmapTreeNodes.parentId);
      for (const r of childRows) {
        if (r.parentId) childCounts.set(r.parentId, Number(r.n));
      }
    }

    cards = wsRows
      .map((w): DiscoverWorkspace => {
        const roots = rootsByWs.get(w.id) ?? [];
        let totalPhases: number;
        if (roots.length === 1) {
          totalPhases = childCounts.get(roots[0]!) ?? 0;
        } else {
          totalPhases = roots.length;
        }
        return {
          id: w.id,
          slug: w.slug,
          name: w.name,
          ownerUserId: w.ownerUserId,
          totalNodes: totalByWs.get(w.id) ?? 0,
          totalPhases,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  }

  return (
    <main
      className="min-h-dvh"
      style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
    >
      <section className="mx-auto max-w-6xl px-5 md:px-8 pt-12 pb-10 md:pt-20 md:pb-14 text-center">
        <Badge variant="outline" className="mx-auto mb-5 gap-1.5">
          <Sparkles className="size-3 text-primary" />
          Cộng đồng công khai
        </Badge>
        <h1 className="text-3xl md:text-5xl font-bold tracking-tight leading-[1.1]">
          Khám phá lộ trình công khai
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm md:text-base text-muted-foreground">
          Đọc, mượn ý tưởng và lấy cảm hứng từ những lộ trình học tập do cộng đồng chia sẻ.
        </p>
        <div className="mt-5 flex items-center justify-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 font-mono">
            <span className="size-1.5 rounded-full bg-primary" />
            {cards.length} lộ trình công khai
          </span>
          <Link
            href="/"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Trang chủ
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 md:px-8 pb-20">
        <DiscoverGrid workspaces={cards} />
      </section>
    </main>
  );
}
