/**
 * Tree cascade primitives — descendant/ancestor traversal + hierarchical gates.
 *
 * Extracted from actions/tree-nodes.ts so the invariants (the easiest place
 * to introduce bugs) live in one testable module:
 *   - Descendant lookup via materialized pathStr containment.
 *   - "Mark done" gate: ALL descendants must already be done.
 *   - "Mark todo" cascade-up: any done ancestor is re-opened.
 *
 * pathStr convention: "rootId/childId/grandId". A node's descendants are the
 * nodes whose pathStr contains that node's id (as an exact segment).
 */
import { and, eq, inArray, sql as dsql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { roadmapTreeNodes, userNodeProgress } from '@/lib/db/schema';

/** Select-condition matching the node itself + all its descendants. */
export function subtreeCondition(workspaceId: string, nodeId: string) {
  return and(
    eq(roadmapTreeNodes.workspaceId, workspaceId),
    dsql`(${roadmapTreeNodes.pathStr} = ${nodeId}
          OR ${roadmapTreeNodes.pathStr} LIKE ${nodeId + '/%'}
          OR ${roadmapTreeNodes.pathStr} LIKE ${'%/' + nodeId}
          OR ${roadmapTreeNodes.pathStr} LIKE ${'%/' + nodeId + '/%'})`,
  );
}

/** IDs of all STRICT descendants of the node (excluding itself). */
export async function descendantIds(workspaceId: string, nodeId: string): Promise<string[]> {
  const rows = await db
    .select({ id: roadmapTreeNodes.id })
    .from(roadmapTreeNodes)
    .where(subtreeCondition(workspaceId, nodeId));
  return rows.map((r) => r.id).filter((id) => id !== nodeId);
}

/**
 * Hierarchical gate for "mark done": every descendant must already be done.
 * Returns the list of incomplete descendant ids (empty = gate passes).
 */
export async function incompleteDescendants(
  workspaceId: string,
  userId: string,
  nodeId: string,
): Promise<{ incomplete: string[]; total: number }> {
  const ids = await descendantIds(workspaceId, nodeId);
  if (ids.length === 0) return { incomplete: [], total: 0 };

  const doneRows = await db
    .select({ nodeId: userNodeProgress.nodeId })
    .from(userNodeProgress)
    .where(
      and(
        eq(userNodeProgress.workspaceId, workspaceId),
        eq(userNodeProgress.userId, userId),
        inArray(userNodeProgress.nodeId, ids),
        eq(userNodeProgress.status, 'done'),
      ),
    );
  const doneSet = new Set(doneRows.map((r) => r.nodeId));
  return { incomplete: ids.filter((id) => !doneSet.has(id)), total: ids.length };
}

/**
 * Cascade-up: after a node is un-done, re-open every done ancestor so a done
 * parent never has an undone child. Returns how many ancestors were re-opened.
 */
export async function reopenDoneAncestors(
  workspaceId: string,
  userId: string,
  pathStr: string | null,
): Promise<number> {
  const ancestorIds = (pathStr ?? '').split('/').filter(Boolean);
  if (ancestorIds.length === 0) return 0;

  const rows = await db
    .select({ id: userNodeProgress.id })
    .from(userNodeProgress)
    .where(
      and(
        eq(userNodeProgress.workspaceId, workspaceId),
        eq(userNodeProgress.userId, userId),
        inArray(userNodeProgress.nodeId, ancestorIds),
        eq(userNodeProgress.status, 'done'),
      ),
    );
  for (const r of rows) {
    await db
      .update(userNodeProgress)
      .set({ status: 'todo', completedAt: null, updatedAt: new Date() })
      .where(
        and(
          eq(userNodeProgress.id, r.id),
          eq(userNodeProgress.workspaceId, workspaceId),
        ),
      );
  }
  return rows.length;
}
