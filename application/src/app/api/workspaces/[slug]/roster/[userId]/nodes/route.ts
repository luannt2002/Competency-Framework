/**
 * GET /api/workspaces/[slug]/roster/[userId]/nodes — D4.2 member drill-down.
 *
 * EDITOR+ gated, workspace-scoped. Returns per-phase → per-node done/undone
 * breakdown for ONE member (the owner or an explicit workspace_members row of
 * this workspace). The roster drawer fetches this on open so the roster page
 * stays light (it only loads phase-level aggregates).
 *
 * Shape:
 *   { phases: [{ id, title, nodeType, done, total,
 *                nodes: [{ id, title, nodeType, depth, done }] }] }
 *
 * Nodes are ordered by tree position (orderIndex along the ancestry path).
 */
import { NextResponse } from 'next/server';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import {
  roadmapTreeNodes,
  userNodeProgress,
  workspaces,
  workspaceMembers,
} from '@/lib/db/schema';
import { resolveWorkspace } from '@/lib/rbac/resolve';
import { RBAC_LEVELS } from '@/lib/rbac/levels';
import { bucketNodesByPhase, phaseStats } from '@/lib/admin/roster-format';
import { loadPhases } from '@/lib/admin/roster-data';
import { mapErrorToResponse } from '@/lib/api/error-response';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string; userId: string }> },
) {
  try {
    const { slug, userId } = await params;
    // Throws generic WORKSPACE_NOT_FOUND_OR_FORBIDDEN when missing or < EDITOR.
    const { ws } = await resolveWorkspace(slug, RBAC_LEVELS.EDITOR);

    // Target must be a member of THIS workspace (implied owner or explicit row).
    const [wsRow] = await db
      .select({ ownerUserId: workspaces.ownerUserId })
      .from(workspaces)
      .where(eq(workspaces.id, ws.id))
      .limit(1);
    const isOwner = wsRow?.ownerUserId === userId;
    let isMember = isOwner;
    if (!isOwner) {
      const rows = await db
        .select({ id: workspaceMembers.id })
        .from(workspaceMembers)
        .where(
          and(eq(workspaceMembers.workspaceId, ws.id), eq(workspaceMembers.userId, userId)),
        )
        .limit(1);
      isMember = rows.length > 0;
    }
    if (!isMember) {
      return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    }

    const phases = await loadPhases(ws.id);
    const phaseIds = phases.map((p) => p.id);

    // Full node rows (workspace-scoped) for titles/depth/ordering.
    const nodeRows = await db
      .select({
        id: roadmapTreeNodes.id,
        title: roadmapTreeNodes.title,
        nodeType: roadmapTreeNodes.nodeType,
        pathStr: roadmapTreeNodes.pathStr,
        depth: roadmapTreeNodes.depth,
        orderIndex: roadmapTreeNodes.orderIndex,
      })
      .from(roadmapTreeNodes)
      .where(eq(roadmapTreeNodes.workspaceId, ws.id))
      .orderBy(asc(roadmapTreeNodes.depth), asc(roadmapTreeNodes.orderIndex));

    const orderByNode = new Map(nodeRows.map((n) => [n.id, n.orderIndex]));
    const buckets = bucketNodesByPhase(nodeRows, phaseIds);

    // Done set for this member (workspace-scoped, any-status rows exist check
    // not needed here — only 'done' matters for the breakdown).
    const allDescendants = Array.from(new Set(phaseIds.flatMap((pid) => buckets.get(pid) ?? [])));
    const doneIds = new Set<string>();
    if (allDescendants.length > 0) {
      const doneRows = await db
        .select({ nodeId: userNodeProgress.nodeId })
        .from(userNodeProgress)
        .where(
          and(
            eq(userNodeProgress.workspaceId, ws.id),
            eq(userNodeProgress.userId, userId),
            eq(userNodeProgress.status, 'done'),
            inArray(userNodeProgress.nodeId, allDescendants),
          ),
        );
      for (const r of doneRows) doneIds.add(r.nodeId);
    }

    /** Sort key = zero-padded orderIndex of every ancestor along pathStr. */
    const sortKey = (n: { pathStr: string }): string =>
      n.pathStr
        .split('/')
        .filter(Boolean)
        .map((id) => String(orderByNode.get(id) ?? 0).padStart(6, '0'))
        .join('/');

    const byId = new Map(nodeRows.map((n) => [n.id, n]));
    const payloadPhases = phases.map((p) => {
      const ids = buckets.get(p.id) ?? [];
      const stats = phaseStats(ids, doneIds);
      const nodes = ids
        .map((id) => byId.get(id))
        .filter((n): n is NonNullable<typeof n> => Boolean(n))
        .sort((a, b) => sortKey(a).localeCompare(sortKey(b)))
        .map((n) => ({
          id: n.id,
          title: n.title,
          nodeType: n.nodeType,
          depth: n.depth,
          done: doneIds.has(n.id),
        }));
      return { id: p.id, title: p.title, nodeType: p.nodeType, ...stats, nodes };
    });

    return NextResponse.json({ phases: payloadPhases });
  } catch (error) {
    return mapErrorToResponse(error);
  }
}
