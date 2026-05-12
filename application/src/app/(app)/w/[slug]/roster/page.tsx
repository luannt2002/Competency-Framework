/**
 * /w/[slug]/roster — Instructor roster (EDITOR+).
 *
 * Server Component. Shows a grid where rows are workspace members (including
 * the implied owner row) and columns are the first up to 6 top-level phases
 * (root nodes in `roadmap_tree_nodes`). Each cell displays a member×phase
 * completion percentage rendered as a heatmap-intensity coral chip.
 *
 * Access: requireMinLevel(workspace, EDITOR). Non-editors are redirected to
 * /w/[slug]; we DON'T 404 to stay consistent with /members and /audit which
 * also redirect for forbidden access.
 *
 * Data model:
 *   - Phases  = roadmap_tree_nodes WHERE parent_id IS NULL (top 6 by order).
 *   - For each phase, the "descendant set" is every node whose pathStr
 *     starts with that phase's id (the phase itself is excluded — only
 *     children/grand-children count toward learner progress).
 *   - Per member, we count done nodes within each descendant set via
 *     user_node_progress (status='done').
 *   - Completion % = done / |descendants|.
 *
 * The owner row uses workspaces.owner_user_id; the explicit workspace_members
 * table only stores non-owner grants.
 *
 * Per-member breakdown is opened via the client-side `RosterRow` (drawer).
 */
import { redirect } from 'next/navigation';
import { eq, asc, sql as dsql, and, inArray } from 'drizzle-orm';
import { Users, ClipboardList, Trophy, Activity } from 'lucide-react';
import { db } from '@/lib/db/client';
import {
  workspaces,
  workspaceMembers,
  roadmapTreeNodes,
  userNodeProgress,
} from '@/lib/db/schema';
import { requireUser } from '@/lib/auth/supabase-server';
import { RBAC_LEVELS } from '@/lib/rbac/levels';
import { requireMinLevel, RBACError } from '@/lib/rbac/server';
import { StatChip } from '@/components/learn/stat-chip';
import { EmptyState } from '@/components/ui/empty-state';
import { RosterTable, type RosterMemberData, type RosterPhaseColumn } from '@/components/admin/roster-table';

export default async function RosterPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  await requireUser();

  const wsRows = await db
    .select({
      id: workspaces.id,
      slug: workspaces.slug,
      name: workspaces.name,
      ownerUserId: workspaces.ownerUserId,
    })
    .from(workspaces)
    .where(eq(workspaces.slug, slug))
    .limit(1);
  const ws = wsRows[0];
  if (!ws) redirect('/');

  // EDITOR+ (level >= 60) can view.
  try {
    await requireMinLevel(ws.id, RBAC_LEVELS.EDITOR);
  } catch (err) {
    if (err instanceof RBACError) redirect(`/w/${ws.slug}`);
    throw err;
  }

  // 1. Phases (top-level nodes), LIMIT 6.
  const phaseRows = await db
    .select({
      id: roadmapTreeNodes.id,
      title: roadmapTreeNodes.title,
      nodeType: roadmapTreeNodes.nodeType,
      orderIndex: roadmapTreeNodes.orderIndex,
    })
    .from(roadmapTreeNodes)
    .where(
      and(
        eq(roadmapTreeNodes.workspaceId, ws.id),
        dsql`${roadmapTreeNodes.parentId} IS NULL`,
      ),
    )
    .orderBy(asc(roadmapTreeNodes.orderIndex))
    .limit(6);

  // 2. For each phase, fetch the total count of its descendants (nodes whose
  //    pathStr starts with the phase id). One round-trip total via a CASE
  //    SUM grouping by phase id.
  const phaseIds = phaseRows.map((p) => p.id);
  const phaseDescendantCount = new Map<string, number>();
  const descendantIdsByPhase = new Map<string, string[]>();

  if (phaseIds.length > 0) {
    // Fetch all nodes once and bucket by pathStr prefix in JS — simpler than
    // N x LIKE queries and the tree size is bounded (286 nodes in the
    // canonical DevOps workspace).
    const allNodes = await db
      .select({
        id: roadmapTreeNodes.id,
        pathStr: roadmapTreeNodes.pathStr,
      })
      .from(roadmapTreeNodes)
      .where(eq(roadmapTreeNodes.workspaceId, ws.id));

    for (const pid of phaseIds) {
      descendantIdsByPhase.set(pid, []);
    }
    for (const n of allNodes) {
      // pathStr looks like "<root>/<child>/<grandchild>" — first segment is
      // the phase id when this node belongs to a phase subtree.
      const segments = n.pathStr.split('/').filter(Boolean);
      const rootId = segments[0];
      if (rootId && descendantIdsByPhase.has(rootId) && n.id !== rootId) {
        descendantIdsByPhase.get(rootId)!.push(n.id);
      }
    }
    for (const [pid, ids] of descendantIdsByPhase) {
      phaseDescendantCount.set(pid, ids.length);
    }
  }

  // 3. Members — owner row synthesized from workspaces.owner_user_id, plus
  //    explicit workspace_members rows.
  const memberRows = await db
    .select({
      id: workspaceMembers.id,
      userId: workspaceMembers.userId,
      role: workspaceMembers.role,
      joinedAt: workspaceMembers.joinedAt,
    })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.workspaceId, ws.id));

  type Member = { key: string; userId: string; role: string; isOwner: boolean };
  const members: Member[] = [];
  if (ws.ownerUserId) {
    members.push({
      key: `owner:${ws.ownerUserId}`,
      userId: ws.ownerUserId,
      role: 'workspace_owner',
      isOwner: true,
    });
  }
  for (const m of memberRows) {
    members.push({ key: m.id, userId: m.userId, role: m.role, isOwner: false });
  }

  // 4. For each member, query their done counts per phase descendant-set.
  //    Use a single grouped query per member with an inArray over each
  //    phase's descendants — small N (members × phases) so this is fine.
  const allDescendantIds = new Set<string>();
  for (const ids of descendantIdsByPhase.values()) {
    for (const id of ids) allDescendantIds.add(id);
  }
  const allDescendantsArr = Array.from(allDescendantIds);

  // Per-member done set across the whole tree, then bucket by phase in JS.
  const doneNodesByMember = new Map<string, Set<string>>();
  if (allDescendantsArr.length > 0 && members.length > 0) {
    const memberUserIds = members.map((m) => m.userId);
    const doneRows = await db
      .select({
        userId: userNodeProgress.userId,
        nodeId: userNodeProgress.nodeId,
      })
      .from(userNodeProgress)
      .where(
        and(
          eq(userNodeProgress.workspaceId, ws.id),
          eq(userNodeProgress.status, 'done'),
          inArray(userNodeProgress.userId, memberUserIds),
          inArray(userNodeProgress.nodeId, allDescendantsArr),
        ),
      );
    for (const r of doneRows) {
      let set = doneNodesByMember.get(r.userId);
      if (!set) {
        set = new Set<string>();
        doneNodesByMember.set(r.userId, set);
      }
      set.add(r.nodeId);
    }
  }

  // 5. Build the data shape consumed by the client table.
  const phaseColumns: RosterPhaseColumn[] = phaseRows.map((p) => ({
    id: p.id,
    title: p.title,
    nodeType: p.nodeType,
    total: phaseDescendantCount.get(p.id) ?? 0,
  }));

  const memberData: RosterMemberData[] = members.map((m) => {
    const doneSet = doneNodesByMember.get(m.userId) ?? new Set<string>();
    const perPhase = phaseColumns.map((p) => {
      const ids = descendantIdsByPhase.get(p.id) ?? [];
      const done = ids.reduce((acc, id) => (doneSet.has(id) ? acc + 1 : acc), 0);
      const pct = p.total > 0 ? Math.round((done / p.total) * 100) : 0;
      return { phaseId: p.id, done, total: p.total, pct };
    });
    // Overall completion across all phase descendants.
    const total = phaseColumns.reduce((a, p) => a + p.total, 0);
    const done = perPhase.reduce((a, c) => a + c.done, 0);
    const overallPct = total > 0 ? Math.round((done / total) * 100) : 0;
    return {
      key: m.key,
      userId: m.userId,
      role: m.role,
      isOwner: m.isOwner,
      perPhase,
      overallPct,
    };
  });

  // Aggregate header stats.
  const totalMembers = memberData.length;
  const avgCompletion =
    totalMembers > 0
      ? Math.round(memberData.reduce((a, m) => a + m.overallPct, 0) / totalMembers)
      : 0;
  const completedCount = memberData.filter((m) => m.overallPct >= 100).length;

  return (
    <div
      className="mx-auto max-w-6xl p-6 md:p-10 space-y-8"
      style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
    >
      <header className="flex items-center gap-4">
        <div className="size-12 rounded-2xl accent-gradient flex items-center justify-center shadow-lg shadow-cyan-500/20">
          <ClipboardList className="size-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Roster</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {ws.name} · per-member progress across top-level phases.
          </p>
        </div>
      </header>

      <section className="grid gap-3 grid-cols-2 md:grid-cols-3 max-w-2xl">
        <StatChip
          icon={Users}
          label="Members"
          value={String(totalMembers)}
          sub="incl. owner"
          color="text-cyan-500"
        />
        <StatChip
          icon={Activity}
          label="Average"
          value={`${avgCompletion}%`}
          sub="completion"
          color="text-amber-500"
        />
        <StatChip
          icon={Trophy}
          label="Completed"
          value={String(completedCount)}
          sub="100% members"
          color="text-emerald-500"
        />
      </section>

      {phaseColumns.length === 0 || memberData.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Roster is empty"
          description={
            phaseColumns.length === 0
              ? 'No top-level phases yet — seed the roadmap first.'
              : 'No members yet — invite someone from /w/[slug]/members.'
          }
        />
      ) : (
        <RosterTable phases={phaseColumns} members={memberData} />
      )}
    </div>
  );
}
