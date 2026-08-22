/**
 * Server-side aggregation queries for creator learning analytics (Flow C5).
 *
 * Access control is NOT done here — callers (page.tsx) must first pass
 * `requireMinLevel(ws.id, RBAC_LEVELS.EDITOR)`. Every query is
 * workspace-scoped (guard:no-tenant-scope).
 *
 * Cost notes:
 *  - Each helper is 1-2 queries total (no N+1 over members/nodes).
 *  - Node stats: ONE grouped query over user_node_progress (GROUP BY node_id
 *    with FILTER aggregates); node titles/breadcrumbs come from a single
 *    workspace node fetch reused by the page.
 *  - Skill distribution: ONE grouped join query.
 */
import { and, count, eq, sql as dsql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import {
  activityLog,
  competencyLevels,
  roadmapTreeNodes,
  skills,
  streaks,
  userNodeProgress,
  userSkillProgress,
  workspaceMembers,
  workspaces,
} from '@/lib/db/schema';
import { DAY_MS } from './metrics';
import { isoDaysAgoVN, startOfDayVN } from '@/lib/day-vn';

/* ============================== C5.1 — Overview ============================== */

export type OverviewStats = {
  /** Tổng số người học (owner ngầm định + workspace_members). */
  memberCount: number;
  /** Trung bình % hoàn thành cây của các member. */
  avgCompletionPct: number;
  /** Số người có hoạt động trong 7 ngày qua (activity_log hoặc streak). */
  activeThisWeek: number;
  /** Số node trong cây (denominator cho completion). */
  nodeCount: number;
};

/**
 * Overview cho workspace:
 *  1. members = workspace_members rows + 1 owner ngầm định (SSoT:
 *     workspaces.owner_user_id, giống roster).
 *  2. % hoàn thành = done nodes / tổng nodes (bỏ node root top-level khỏi
 *     denominator — root là container, không phải bài học; giống roster chỉ
 *     đếm descendants).
 *  3. Active tuần này = UNION distinct userId có activity_log trong 7d HOẶC
 *     streaks.last_active_date trong 7d.
 *
 * Cost: 5 truy vấn phẳng, mỗi truy vấn dùng index (ws_user_idx /
 * ws_user_created_idx / pk) — không quét theo member.
 */
export async function getOverviewStats(workspaceId: string): Promise<OverviewStats> {
  // Mốc "7 ngày qua" cắt theo giờ VN cho khớp với `streaks.last_active_date`
  // (cột đó do `todayVN()` ghi). Cắt theo UTC thì hai bên lệch nhau 7 tiếng và
  // người vừa hoạt động sáng sớm bị đếm nhầm sang ngày trước.
  const weekAgoDate = isoDaysAgoVN(7);

  const [wsRow, memberRows, nodeRows, doneRows, activityRows, streakRows] =
    await Promise.all([
      db
        .select({ ownerUserId: workspaces.ownerUserId })
        .from(workspaces)
        .where(eq(workspaces.id, workspaceId))
        .limit(1),
      db
        .select({ userId: workspaceMembers.userId })
        .from(workspaceMembers)
        .where(eq(workspaceMembers.workspaceId, workspaceId)),
      db
        .select({ id: roadmapTreeNodes.id, parentId: roadmapTreeNodes.parentId })
        .from(roadmapTreeNodes)
        .where(eq(roadmapTreeNodes.workspaceId, workspaceId)),
      db
        .select({ userId: userNodeProgress.userId, n: count() })
        .from(userNodeProgress)
        .where(
          and(
            eq(userNodeProgress.workspaceId, workspaceId),
            eq(userNodeProgress.status, 'done'),
          ),
        )
        .groupBy(userNodeProgress.userId),
      db
        .selectDistinct({ userId: activityLog.userId })
        .from(activityLog)
        .where(
          and(
            eq(activityLog.workspaceId, workspaceId),
            dsql`${activityLog.createdAt} >= ${startOfDayVN(weekAgoDate).toISOString()}`,
          ),
        ),
      db
        .select({ userId: streaks.userId })
        .from(streaks)
        .where(
          and(
            eq(streaks.workspaceId, workspaceId),
            dsql`${streaks.lastActiveDate} >= ${weekAgoDate}`,
          ),
        ),
    ]);

  const memberIds = new Set<string>(memberRows.map((m) => m.userId));
  if (wsRow[0]?.ownerUserId) memberIds.add(wsRow[0].ownerUserId);

  // Denominator: mọi node trừ root top-level (parentId IS NULL).
  const learnableNodes = nodeRows.filter((n) => n.parentId !== null).length;

  const doneByUser = new Map(doneRows.map((r) => [r.userId, Number(r.n)]));
  const pcts: number[] = [];
  for (const uid of memberIds) {
    const done = doneByUser.get(uid) ?? 0;
    pcts.push(learnableNodes > 0 ? Math.round((done / learnableNodes) * 100) : 0);
  }
  const avgCompletionPct =
    pcts.length > 0 ? Math.round(pcts.reduce((a, v) => a + v, 0) / pcts.length) : 0;

  const activeIds = new Set<string>([
    ...activityRows.map((r) => r.userId),
    ...streakRows.map((r) => r.userId),
  ]);

  return {
    memberCount: memberIds.size,
    avgCompletionPct,
    activeThisWeek: activeIds.size,
    nodeCount: nodeRows.length,
  };
}

/* ========================= C5.2 — Stuck / drop-off ========================= */

export type NodeStuckStats = {
  nodeId: string;
  /** Số learner có bất kỳ progress row nào trên node (todo/doing/done/skipped). */
  started: number;
  /** Số learner done. */
  done: number;
  /** started-nhưng-chưa-done và không chạm node này >= 7 ngày (SQL FILTER). */
  stuck: number;
};

/**
 * MỘT grouped query duy nhất trên user_node_progress (C5.2 yêu cầu): GROUP BY
 * node_id, mỗi nhóm tính started/done/stuck bằng aggregate FILTER. Stuck được
 * tính ngay trong SQL để không kéo per-user rows về app.
 *
 * Cost: 1 index scan trên (workspace_id) + aggregate — không N+1.
 */
export async function getNodeStuckStats(
  workspaceId: string,
  now: Date = new Date(),
): Promise<Map<string, NodeStuckStats>> {
  const cutoff = new Date(now.getTime() - 7 * DAY_MS);
  const rows = await db
    .select({
      nodeId: userNodeProgress.nodeId,
      started: count(),
      done: dsql<number>`count(*) filter (where ${userNodeProgress.status} = 'done')`,
      stuck: dsql<number>`count(*) filter (where ${userNodeProgress.status} <> 'done' and ${userNodeProgress.updatedAt} < ${cutoff.toISOString()})`,
    })
    .from(userNodeProgress)
    .where(eq(userNodeProgress.workspaceId, workspaceId))
    .groupBy(userNodeProgress.nodeId);

  const out = new Map<string, NodeStuckStats>();
  for (const r of rows) {
    out.set(r.nodeId, {
      nodeId: r.nodeId,
      started: Number(r.started),
      done: Number(r.done),
      stuck: Number(r.stuck),
    });
  }
  return out;
}

/* ========================= C5.3 — Skill distribution ========================= */

export type SkillDistributionRow = {
  skillId: string;
  skillName: string;
  /** Trung bình numeric_value của level hiện tại (null khi chưa map level). */
  avgLevelValue: number | null;
  /** Trung bình crowns 0-5. */
  avgCrowns: number | null;
  /** Số learner có progress trên skill này. */
  learners: number;
  selfClaimed: number;
  learned: number;
  /** Vừa tự nhận vừa học xong — bỏ sót giá trị này làm phân bố ra 0/0/0. */
  both: number;
  verified: number;
};

/**
 * Phân bố kỹ năng của cả team (C5.3): MỘT grouped join query trên
 * user_skill_progress ⋈ skills ⋈ competency_levels.
 *
 * Cost: 1 query, index theo (workspace_id, user_id) / skills pk; nhóm theo
 * skill nên số hàng trả về = số skill có progress.
 */
export async function getSkillDistribution(
  workspaceId: string,
): Promise<SkillDistributionRow[]> {
  const rows = await db
    .select({
      skillId: skills.id,
      skillName: skills.name,
      avgLevelValue: dsql<
        number | null
      >`avg(${competencyLevels.numericValue}) filter (where ${competencyLevels.numericValue} is not null)`,
      avgCrowns: dsql<
        number | null
      >`avg(${userSkillProgress.crowns}) filter (where ${userSkillProgress.crowns} is not null)`,
      learners: count(),
      // `level_source` có BỐN giá trị, không phải ba. Bỏ sót `both` làm cả ba
      // thanh phân bố ra 0 khi learner duy nhất đang ở trạng thái đó — đo được
      // trên dữ liệu thật: 1 learner, bar rộng 0 (rà C5.4).
      selfClaimed: dsql<number>`count(*) filter (where ${userSkillProgress.levelSource} = 'self_claimed')`,
      learned: dsql<number>`count(*) filter (where ${userSkillProgress.levelSource} = 'learned')`,
      both: dsql<number>`count(*) filter (where ${userSkillProgress.levelSource} = 'both')`,
      verified: dsql<number>`count(*) filter (where ${userSkillProgress.levelSource} = 'verified')`,
    })
    .from(userSkillProgress)
    .innerJoin(
      skills,
      and(eq(skills.id, userSkillProgress.skillId), eq(skills.workspaceId, workspaceId)),
    )
    .leftJoin(
      competencyLevels,
      and(
        eq(competencyLevels.workspaceId, workspaceId),
        eq(competencyLevels.code, userSkillProgress.levelCode),
      ),
    )
    .where(eq(userSkillProgress.workspaceId, workspaceId))
    .groupBy(skills.id, skills.name)
    // Xếp theo mức độ được XÁC MINH: verified trước, rồi tới both (đã học +
    // tự nhận). Chỉ đếm `verified` thì mọi kỹ năng chưa ai duyệt đều hoà 0 và
    // thứ tự trở thành ngẫu nhiên.
    .orderBy(
      dsql`count(*) filter (where ${userSkillProgress.levelSource} = 'verified') desc,
           count(*) filter (where ${userSkillProgress.levelSource} = 'both') desc,
           count(*) desc`,
    );

  return rows.map((r) => ({
    skillId: r.skillId,
    skillName: r.skillName,
    avgLevelValue: r.avgLevelValue === null ? null : Number(r.avgLevelValue),
    avgCrowns: r.avgCrowns === null ? null : Number(r.avgCrowns),
    learners: Number(r.learners),
    selfClaimed: Number(r.selfClaimed),
    learned: Number(r.learned),
    both: Number(r.both),
    verified: Number(r.verified),
  }));
}

/* ===================== Shared node metadata for the page ===================== */

export type NodeMeta = {
  id: string;
  title: string;
  slug: string;
  pathStr: string;
};

/**
 * Một query lấy mọi node của workspace (id/title/slug/pathStr) — dùng cho
 * cả breadcrumb stuck nodes lẫn node-slug links. Cây có kích thước bounded
 * (vài trăm node) nên fetch phẳng rồi xử lý trong JS là rẻ hơn N query.
 */
export async function getWorkspaceNodeMeta(workspaceId: string): Promise<NodeMeta[]> {
  return db
    .select({
      id: roadmapTreeNodes.id,
      title: roadmapTreeNodes.title,
      slug: roadmapTreeNodes.slug,
      pathStr: roadmapTreeNodes.pathStr,
    })
    .from(roadmapTreeNodes)
    .where(eq(roadmapTreeNodes.workspaceId, workspaceId));
}

/** Tiện ích: chỉ giữ các node id có trong `ids` (đã filter ở caller). */
export function filterNodeMetaByIds(metas: NodeMeta[], ids: string[]): NodeMeta[] {
  const set = new Set(ids);
  return metas.filter((m) => set.has(m.id));
}
