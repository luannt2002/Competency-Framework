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
 *   - description: lấy từ `workspaces.description`; nếu chưa có thì lùi về mô
 *     tả của node gốc (chỉ đúng khi cây có một gốc — đường lùi cho dữ liệu cũ).
 *   - domain: no domain/tag column either — approximated with the root
 *     node's `nodeType` (course/phase/...) as a coarse category filter.
 *     No schema change is invented for this (audit E1.1 decision).
 *   - forkCount: workspaces do NOT record their fork source (no forkedFrom
 *     column), but every fork writes an activity_log row of kind
 *     `workspace_forked` whose payload carries `sourceWorkspaceId`. We count
 *     distinct forking actors per source from activity_log. If a real
 *     linkage column is added later, switch to it (audit E1.2 decision).
 *
 * All numbers are computed in grouped SQL queries (no N+1).
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { and, eq, inArray, isNull, sql as dsql } from 'drizzle-orm';
import { Sparkles } from 'lucide-react';
import { db } from '@/lib/db/client';
import { workspaces, roadmapTreeNodes, activityLog } from '@/lib/db/schema';
import {
  DiscoverGrid,
  type DiscoverWorkspace,
} from '@/components/discover/discover-grid';
import { Badge } from '@/components/ui/badge';
import { FadeInSection } from '@/components/ui/fade-in-section';
import { NumberedSection } from '@/components/ui/numbered-section';

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
      description: workspaces.description,
      ownerUserId: workspaces.ownerUserId,
      createdAt: workspaces.createdAt,
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
    //    ARE the top-level phases. The root's nodeType doubles as a coarse
    //    domain/category (no domain column exists) and its description is
    //    used as the card description (same trick as the share page metadata).
    const rootRows = await db
      .select({
        id: roadmapTreeNodes.id,
        workspaceId: roadmapTreeNodes.workspaceId,
        nodeType: roadmapTreeNodes.nodeType,
        description: roadmapTreeNodes.description,
      })
      .from(roadmapTreeNodes)
      .where(
        and(
          inArray(roadmapTreeNodes.workspaceId, ids),
          isNull(roadmapTreeNodes.parentId),
        ),
      );
    const rootsByWs = new Map<string, string[]>();
    const rootMetaByWs = new Map<
      string,
      { nodeType: string; description: string | null }
    >();
    for (const r of rootRows) {
      const arr = rootsByWs.get(r.workspaceId) ?? [];
      arr.push(r.id);
      rootsByWs.set(r.workspaceId, arr);
      if (arr.length === 1) {
        rootMetaByWs.set(r.workspaceId, {
          nodeType: r.nodeType,
          description: r.description,
        });
      } else {
        rootMetaByWs.delete(r.workspaceId);
      }
    }

    // 3b) Fork counts — count distinct forking actors per source workspace
    //     from activity_log `workspace_forked` rows (payload.sourceWorkspaceId).
    //     There is no forkedFrom column on workspaces; activity_log is the
    //     only reliable record of the fork linkage.
    const forkRows = await db
      .select({
        sourceId: dsql<string>`payload->>'sourceWorkspaceId'`,
        actors: dsql<number>`count(distinct ${activityLog.userId})::int`,
      })
      .from(activityLog) // guard-tenant-scope: allow — cross-workspace aggregation over public workspaces' fork events; payload->>'sourceWorkspaceId' is the workspaceId linkage
      .where(eq(activityLog.kind, 'workspace_forked'))
      .groupBy(dsql`payload->>'sourceWorkspaceId'`);
    const forksBySource = new Map<string, number>(
      forkRows
        .filter((r) => r.sourceId)
        .map((r) => [r.sourceId, Number(r.actors)]),
    );

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
        .from(roadmapTreeNodes) // guard-tenant-scope: allow — singleRootIds come from the workspace-filtered rootRows query above
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
        const rootMeta = rootMetaByWs.get(w.id);
        return {
          id: w.id,
          slug: w.slug,
          name: w.name,
          ownerUserId: w.ownerUserId,
          createdAt: (w.createdAt ?? new Date(0)).toISOString(),
          totalNodes: totalByWs.get(w.id) ?? 0,
          totalPhases,
          rootNodeType: rootMeta?.nodeType ?? null,
          // Mô tả của chính workspace đứng trước; mô tả node gốc chỉ là đường
          // lùi cho dữ liệu cũ. Trước khi có cột này, thẻ trên /discover không
          // có gì ngoài cái tên — mất một tín hiệu tin cậy ở đúng cửa vào.
          description: w.description ?? rootMeta?.description ?? null,
          forkCount: forksBySource.get(w.id) ?? 0,
        };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  return (
    <main
      className="min-h-dvh"
      style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
    >
      <FadeInSection className="mx-auto max-w-6xl px-5 md:px-8 pt-12 pb-10 md:pt-20 md:pb-14 text-center">
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
      </FadeInSection>

      <FadeInSection
        delay={100}
        className="mx-auto max-w-6xl px-5 md:px-8 pb-20"
      >
        <NumberedSection
          index={1}
          title="Danh sách lộ trình"
          subtitle={`${cards.length} mục`}
        />
        <DiscoverGrid workspaces={cards} />
      </FadeInSection>
    </main>
  );
}
