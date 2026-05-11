/**
 * Workspace resolution + authorization helpers.
 *
 * MVP: a workspace is owned by a single user (workspaces.owner_user_id).
 * Future: org-owned (workspaces.org_id), see DESIGN_FUTURE.md.
 *
 * Every server action and page in /w/[slug]/* MUST call `requireWorkspaceAccess(slug)`
 * before querying any workspace-scoped data.
 */
import { eq, and } from 'drizzle-orm';
import { db } from './db/client';
import { workspaces } from './db/schema';
import { requireUser } from './auth/supabase-server';

export type WorkspaceResolved = {
  id: string;
  slug: string;
  name: string;
  ownerUserId: string;
};

/**
 * Resolve a workspace by slug for the current user.
 * Throws NOT_FOUND if missing or FORBIDDEN if user doesn't own it.
 */
export async function requireWorkspaceAccess(slug: string): Promise<WorkspaceResolved> {
  const user = await requireUser();
  const rows = await db
    .select({
      id: workspaces.id,
      slug: workspaces.slug,
      name: workspaces.name,
      ownerUserId: workspaces.ownerUserId,
    })
    .from(workspaces)
    .where(and(eq(workspaces.slug, slug), eq(workspaces.ownerUserId, user.id)))
    .limit(1);

  const ws = rows[0];
  if (!ws) throw new Error('WORKSPACE_NOT_FOUND_OR_FORBIDDEN');
  if (!ws.ownerUserId) throw new Error('WORKSPACE_INVALID_OWNER');
  return ws as WorkspaceResolved;
}

/** Lists workspaces the current user owns. */
export async function listMyWorkspaces() {
  const user = await requireUser();
  return db
    .select()
    .from(workspaces)
    .where(eq(workspaces.ownerUserId, user.id))
    .orderBy(workspaces.createdAt);
}
