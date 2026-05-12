/**
 * Global search server action — returns all nodes in a workspace so the
 * client-side Cmd+K dialog can do fuzzy filtering without a round-trip per
 * keystroke.
 *
 * RBAC: LEARNER level — same gate as `listTreeForWorkspace`. Viewers/guests
 * receive WORKSPACE_NOT_FOUND_OR_FORBIDDEN (avoids leaking existence).
 *
 * Payload is intentionally tiny (id/slug/title/nodeType) so it scales to
 * a few hundred nodes without bothering with pagination.
 */
'use server';

import { eq, asc } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { workspaces, roadmapTreeNodes } from '@/lib/db/schema';
import { requireUser } from '@/lib/auth/supabase-server';
import { RBAC_LEVELS } from '@/lib/rbac/levels';
import { requireMinLevel, RBACError } from '@/lib/rbac/server';

export type SearchNode = {
  id: string;
  slug: string;
  title: string;
  nodeType: string;
};

export async function searchNodes(workspaceSlug: string): Promise<SearchNode[]> {
  // Auth gate first
  await requireUser();

  const rows = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.slug, workspaceSlug))
    .limit(1);
  const ws = rows[0];
  if (!ws) throw new Error('WORKSPACE_NOT_FOUND_OR_FORBIDDEN');

  try {
    await requireMinLevel(ws.id, RBAC_LEVELS.LEARNER);
  } catch (err) {
    if (err instanceof RBACError) {
      throw new Error('WORKSPACE_NOT_FOUND_OR_FORBIDDEN');
    }
    throw err;
  }

  const nodes = await db
    .select({
      id: roadmapTreeNodes.id,
      slug: roadmapTreeNodes.slug,
      title: roadmapTreeNodes.title,
      nodeType: roadmapTreeNodes.nodeType,
    })
    .from(roadmapTreeNodes)
    .where(eq(roadmapTreeNodes.workspaceId, ws.id))
    .orderBy(asc(roadmapTreeNodes.depth), asc(roadmapTreeNodes.orderIndex));

  return nodes;
}
