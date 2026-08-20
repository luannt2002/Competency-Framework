/**
 * Learner-side node progress domain (USER_FLOWS.md → Flow B4 + "State
 * transition map — Node progress").
 *
 * The tree pages talk to `user_node_progress`, whose status column is the
 * three-state machine `todo → doing → done`. Everything the learner earns for
 * moving through that machine lives here so the action layer only orchestrates:
 *
 *   - `upsertNodeStatus`       — write one status transition (idempotent)
 *   - `attachNodeEvidence`     — evidence URLs + journal note on the progress row
 *   - `awardNodeCompletion`    — XP + streak + badges when a node turns done
 *   - `hasEvidence`            — pure gate helper for "done needs evidence"
 *
 * XP is never removed on un-done: Flow F says "XP chỉ tăng, không bao giờ giảm".
 */
import { and, asc, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { roadmapTreeNodes, userNodeProgress } from '@/lib/db/schema';
import { evaluateBadges, type GrantedBadge } from '@/lib/gamification/badge-evaluator';
import { insertXpOnce, awardStreakTick, type StreakReward } from './xp-award';
import { nodeCompletionXp } from './xp-rules';

/** The three learner-visible states of a tree node. */
export type NodeProgressStatus = 'todo' | 'doing' | 'done';

/** True when the learner attached at least one non-empty evidence URL. */
export function hasEvidence(evidenceUrls: readonly string[] | null | undefined): boolean {
  return (evidenceUrls ?? []).some((u) => u.trim().length > 0);
}

/**
 * Insert-or-update the (workspace, user, node) progress row.
 *
 * Uses the `unp_ws_user_node_uq` unique index for an atomic upsert so two
 * concurrent clicks cannot create duplicate rows.
 */
export async function upsertNodeStatus(params: {
  workspaceId: string;
  userId: string;
  nodeId: string;
  status: NodeProgressStatus;
}): Promise<void> {
  const completedAt = params.status === 'done' ? new Date() : null;
  await db
    .insert(userNodeProgress)
    .values({
      workspaceId: params.workspaceId,
      userId: params.userId,
      nodeId: params.nodeId,
      status: params.status,
      completedAt,
    })
    .onConflictDoUpdate({
      target: [
        userNodeProgress.workspaceId,
        userNodeProgress.userId,
        userNodeProgress.nodeId,
      ],
      set: { status: params.status, completedAt, updatedAt: new Date() },
    });
}

/**
 * Attach evidence URLs (and an optional note) to a node's progress row without
 * changing its status. Creates the row as `doing` when the learner has not
 * started the node yet — attaching proof of work IS starting it.
 */
export async function attachNodeEvidence(params: {
  workspaceId: string;
  userId: string;
  nodeId: string;
  evidenceUrls: string[];
  note: string | null;
}): Promise<void> {
  await db
    .insert(userNodeProgress)
    .values({
      workspaceId: params.workspaceId,
      userId: params.userId,
      nodeId: params.nodeId,
      status: 'doing',
      evidenceUrls: params.evidenceUrls,
      note: params.note,
    })
    .onConflictDoUpdate({
      target: [
        userNodeProgress.workspaceId,
        userNodeProgress.userId,
        userNodeProgress.nodeId,
      ],
      set: {
        evidenceUrls: params.evidenceUrls,
        note: params.note,
        updatedAt: new Date(),
      },
    });
}

/** Current progress row for one node, or null when never touched. */
export async function getNodeProgress(params: {
  workspaceId: string;
  userId: string;
  nodeId: string;
}) {
  const rows = await db
    .select()
    .from(userNodeProgress)
    .where(
      and(
        eq(userNodeProgress.workspaceId, params.workspaceId),
        eq(userNodeProgress.userId, params.userId),
        eq(userNodeProgress.nodeId, params.nodeId),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

/** Minutes assumed for a node whose author left `est_minutes` empty. */
export const DEFAULT_NODE_EST_MINUTES = 15;

export type UnfinishedLeafNode = {
  id: string;
  title: string;
  slug: string;
  nodeType: string;
  estMinutes: number;
  /** true when user_node_progress.status = 'doing'. */
  inProgress: boolean;
};

/**
 * Unfinished LEAF nodes for one learner, ordered "finish what you started"
 * first (freshest 'doing' rows) then the next ones in tree order.
 *
 * Only leaves are returned: a container cannot be marked done until all of its
 * descendants are (toggleNodeDone's hierarchical gate), so offering one as
 * "your next step" would be un-actionable.
 *
 * Shared by the Daily Planner generator (Flow B5) and the dashboard's
 * "Upcoming" rail (Flow B3) so both agree on what "next" means.
 */
export async function listUnfinishedLeafNodes(
  workspaceId: string,
  userId: string,
  limit: number,
): Promise<UnfinishedLeafNode[]> {
  const rows = await db
    .select({
      id: roadmapTreeNodes.id,
      title: roadmapTreeNodes.title,
      slug: roadmapTreeNodes.slug,
      nodeType: roadmapTreeNodes.nodeType,
      estMinutes: roadmapTreeNodes.estMinutes,
      status: userNodeProgress.status,
      updatedAt: userNodeProgress.updatedAt,
    })
    .from(roadmapTreeNodes)
    .leftJoin(
      userNodeProgress,
      and(
        eq(userNodeProgress.nodeId, roadmapTreeNodes.id),
        eq(userNodeProgress.workspaceId, workspaceId),
        eq(userNodeProgress.userId, userId),
      ),
    )
    .where(
      and(
        eq(roadmapTreeNodes.workspaceId, workspaceId),
        sql`NOT EXISTS (
              SELECT 1 FROM roadmap_tree_nodes child
              WHERE child.parent_id = ${roadmapTreeNodes.id}
            )`,
      ),
    )
    .orderBy(asc(roadmapTreeNodes.pathStr), asc(roadmapTreeNodes.orderIndex));

  const unfinished = rows.filter((r) => r.status !== 'done');
  const started = unfinished
    .filter((r) => r.status === 'doing')
    .sort((a, b) => (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0));
  const next = unfinished.filter((r) => r.status !== 'doing');

  return [...started, ...next].slice(0, limit).map((r) => ({
    id: r.id,
    title: r.title,
    slug: r.slug,
    nodeType: r.nodeType,
    estMinutes: r.estMinutes ?? DEFAULT_NODE_EST_MINUTES,
    inProgress: r.status === 'doing',
  }));
}

export type NodeCompletionReward = {
  /** XP paid for the node itself (0 on replay — `insertXpOnce` dedupes). */
  nodeXp: number;
  streak: StreakReward;
  badges: GrantedBadge[];
  /** nodeXp + whatever the streak tick paid. */
  totalXp: number;
};

/**
 * Pay out everything a freshly-completed node earns: node XP (once per node),
 * the daily streak tick, then a badge sweep.
 *
 * Mirrors the reward chain `completeLesson` runs for the lesson tree, so the
 * roadmap tree is not a second-class citizen of the gamification system.
 */
export async function awardNodeCompletion(params: {
  workspaceId: string;
  userId: string;
  nodeId: string;
  depth: number;
  hasChildren: boolean;
}): Promise<NodeCompletionReward> {
  const amount = nodeCompletionXp({ depth: params.depth, hasChildren: params.hasChildren });
  const awarded = await insertXpOnce({
    workspaceId: params.workspaceId,
    userId: params.userId,
    amount,
    reason: 'node_complete',
    refKind: 'tree_node',
    refId: params.nodeId,
  });
  const nodeXp = awarded ? amount : 0;
  const streak = await awardStreakTick(params.workspaceId, params.userId);
  const badges = await evaluateBadges(params.workspaceId, params.userId);
  return { nodeXp, streak, badges, totalXp: nodeXp + streak.xpAwarded };
}
