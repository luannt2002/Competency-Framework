/**
 * roster-data.ts — server-side roster data loader (D3.6/D3.7/D4.2).
 *
 * Shared by the roster export actions (Excel per-member progress, HTML
 * overview report) and the per-member node-breakdown API route. All queries
 * are workspace-scoped (guard:no-tenant-scope).
 *
 * Semantics mirror /w/[slug]/roster/page.tsx:
 *   - Phases = top-level roadmap_tree_nodes (first 6 by orderIndex).
 *   - Descendants of a phase = nodes whose pathStr starts with the phase id
 *     (phase itself excluded).
 *   - Done = user_node_progress.status='done'.
 *   - Last active = max(streaks.last_active_date, latest activity_log row).
 *   - At risk = started AND ≥7 ngày inactive AND <100%.
 */
import { and, asc, eq, inArray, sql as dsql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import {
  activityLog,
  roadmapTreeNodes,
  streaks,
  userNodeProgress,
  workspaceMembers,
  workspaces,
} from '@/lib/db/schema';
import { getUsersDisplay, shortId } from '@/lib/auth/user-display';
import {
  bucketNodesByPhase,
  isAtRisk,
  overallPct,
  phaseStats,
} from '@/lib/admin/roster-format';

export type RosterPhase = {
  id: string;
  title: string;
  nodeType: string;
  total: number;
};

export type RosterMemberRow = {
  userId: string;
  displayName: string;
  email: string | null;
  role: string;
  isOwner: boolean;
  perPhase: { phaseId: string; done: number; total: number; pct: number }[];
  overallPct: number;
  lastActiveISO: string | null;
  atRisk: boolean;
};

export type RosterOverview = {
  workspaceName: string;
  phases: RosterPhase[];
  members: RosterMemberRow[];
};

/** Top-level phases (same LIMIT 6 + ordering as the roster page). */
export async function loadPhases(wsId: string): Promise<RosterPhase[]> {
  const phaseRows = await db
    .select({
      id: roadmapTreeNodes.id,
      title: roadmapTreeNodes.title,
      nodeType: roadmapTreeNodes.nodeType,
    })
    .from(roadmapTreeNodes)
    .where(
      and(eq(roadmapTreeNodes.workspaceId, wsId), dsql`${roadmapTreeNodes.parentId} IS NULL`),
    )
    .orderBy(asc(roadmapTreeNodes.orderIndex))
    .limit(6);
  return phaseRows.map((p) => ({ ...p, total: 0 }));
}

/** id/pathStr of every node in the workspace (tree size is bounded, ~hundreds). */
export async function loadNodePaths(wsId: string): Promise<{ id: string; pathStr: string }[]> {
  return db
    .select({ id: roadmapTreeNodes.id, pathStr: roadmapTreeNodes.pathStr })
    .from(roadmapTreeNodes)
    .where(eq(roadmapTreeNodes.workspaceId, wsId));
}

/** Full roster overview: members × phases with %, last active, at-risk (D3.6/D3.7). */
export async function loadRosterOverview(wsId: string): Promise<RosterOverview> {
  const [wsRow] = await db
    .select({ name: workspaces.name, ownerUserId: workspaces.ownerUserId })
    .from(workspaces)
    .where(eq(workspaces.id, wsId))
    .limit(1);

  const phases = await loadPhases(wsId);
  const phaseIds = phases.map((p) => p.id);
  const buckets = await loadNodePaths(wsId).then((paths) =>
    bucketNodesByPhase(paths, phaseIds),
  );
  for (const p of phases) p.total = buckets.get(p.id)?.length ?? 0;

  // Members: implied owner row + explicit grants.
  const memberRows = await db
    .select({ userId: workspaceMembers.userId, role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.workspaceId, wsId));
  const base: { userId: string; role: string; isOwner: boolean }[] = [];
  if (wsRow?.ownerUserId) {
    base.push({ userId: wsRow.ownerUserId, role: 'workspace_owner', isOwner: true });
  }
  for (const m of memberRows) base.push({ userId: m.userId, role: m.role, isOwner: false });

  // Done sets per member (one query for all members).
  const allDescendants = Array.from(
    new Set(phaseIds.flatMap((pid) => buckets.get(pid) ?? [])),
  );
  const doneByMember = new Map<string, Set<string>>();
  const startedByUser = new Set<string>();
  const userIds = base.map((m) => m.userId);
  if (allDescendants.length > 0 && userIds.length > 0) {
    const doneRows = await db
      .select({ userId: userNodeProgress.userId, nodeId: userNodeProgress.nodeId })
      .from(userNodeProgress)
      .where(
        and(
          eq(userNodeProgress.workspaceId, wsId),
          eq(userNodeProgress.status, 'done'),
          inArray(userNodeProgress.userId, userIds),
          inArray(userNodeProgress.nodeId, allDescendants),
        ),
      );
    for (const r of doneRows) {
      let set = doneByMember.get(r.userId);
      if (!set) {
        set = new Set<string>();
        doneByMember.set(r.userId, set);
      }
      set.add(r.nodeId);
    }
  }

  // Started = has ANY progress row (any status) — mirrors page D3.4 logic.
  if (userIds.length > 0) {
    const startedRows = await db
      .selectDistinct({ userId: userNodeProgress.userId })
      .from(userNodeProgress)
      .where(
        and(eq(userNodeProgress.workspaceId, wsId), inArray(userNodeProgress.userId, userIds)),
      );
    for (const r of startedRows) startedByUser.add(r.userId);
  }

  // Last active = max(streaks.last_active_date, latest activity_log.created_at).
  const lastActiveByUser = new Map<string, Date>();
  if (userIds.length > 0) {
    const streakRows = await db
      .select({ userId: streaks.userId, lastActiveDate: streaks.lastActiveDate })
      .from(streaks)
      .where(and(eq(streaks.workspaceId, wsId), inArray(streaks.userId, userIds)));
    for (const r of streakRows) {
      if (r.lastActiveDate) {
        lastActiveByUser.set(r.userId, new Date(`${r.lastActiveDate}T00:00:00Z`));
      }
    }
    const activityRows = await db
      .select({
        userId: activityLog.userId,
        lastAt: dsql<string | null>`max(${activityLog.createdAt})`,
      })
      .from(activityLog)
      .where(and(eq(activityLog.workspaceId, wsId), inArray(activityLog.userId, userIds)))
      .groupBy(activityLog.userId);
    for (const r of activityRows) {
      const d = r.lastAt ? new Date(r.lastAt) : null;
      if (!d || Number.isNaN(d.getTime())) continue;
      const existing = lastActiveByUser.get(r.userId);
      if (!existing || d > existing) lastActiveByUser.set(r.userId, d);
    }
  }

  const displayByUser = await getUsersDisplay(userIds);

  const members: RosterMemberRow[] = base.map((m) => {
    const doneSet = doneByMember.get(m.userId) ?? new Set<string>();
    const perPhase = phases.map((p) =>
      phaseStats(buckets.get(p.id) ?? [], doneSet),
    ).map((s, i) => ({ phaseId: phases[i]!.id, ...s }));
    const pct = overallPct(perPhase);
    const lastActive = lastActiveByUser.get(m.userId) ?? null;
    const lastActiveISO = lastActive ? lastActive.toISOString() : null;
    const display = displayByUser.get(m.userId);
    return {
      userId: m.userId,
      displayName: display?.displayName ?? shortId(m.userId),
      email: display?.email ?? null,
      role: m.role,
      isOwner: m.isOwner,
      perPhase,
      overallPct: pct,
      lastActiveISO,
      atRisk: isAtRisk({
        started: startedByUser.has(m.userId),
        lastActiveISO,
        overallPct: pct,
      }),
    };
  });

  return { workspaceName: wsRow?.name ?? '', phases, members };
}
