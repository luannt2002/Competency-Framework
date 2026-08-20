/**
 * Workspace resolution + authorization helpers.
 *
 * MVP: a workspace is owned by a single user (workspaces.owner_user_id).
 * Future: org-owned (workspaces.org_id), see DESIGN_FUTURE.md.
 *
 * Every server action and page in /w/[slug]/* MUST call `requireWorkspaceAccess(slug)`
 * before querying any workspace-scoped data.
 */
import { eq } from 'drizzle-orm';
import { db } from './db/client';
import { workspaces } from './db/schema';
import { requireUser } from './auth/supabase-server';
import { requireMinLevel, RBACError } from './rbac/server';
import { RBAC_LEVELS } from './rbac/levels';

export type WorkspaceResolved = {
  id: string;
  slug: string;
  name: string;
  ownerUserId: string;
  /** Emoji icon chosen by the owner (nullable). */
  icon: string | null;
  /** Accent color hex chosen by the owner (nullable, palette-whitelisted). */
  color: string | null;
};

/**
 * Resolve a workspace by slug for the current user.
 *
 * Authorization goes through the same RBAC resolver as server actions
 * (owner OR workspace member ≥ learner). Previously this helper was
 * owner-only, which silently 404'd legitimate members on the API routes —
 * an authz split-brain between routes and actions. Missing workspace and
 * forbidden are intentionally indistinguishable (same error) to avoid
 * slug enumeration.
 */
export async function requireWorkspaceAccess(slug: string): Promise<WorkspaceResolved> {
  const user = await requireUser();
  const rows = await db
    .select({
      id: workspaces.id,
      slug: workspaces.slug,
      name: workspaces.name,
      ownerUserId: workspaces.ownerUserId,
      icon: workspaces.icon,
      color: workspaces.color,
    })
    .from(workspaces)
    .where(eq(workspaces.slug, slug))
    .limit(1);

  const ws = rows[0];
  if (!ws) throw new Error('WORKSPACE_NOT_FOUND_OR_FORBIDDEN');

  try {
    await requireMinLevel(ws.id, RBAC_LEVELS.LEARNER);
  } catch (err) {
    if (err instanceof RBACError) throw new Error('WORKSPACE_NOT_FOUND_OR_FORBIDDEN');
    throw err;
  }

  return {
    id: ws.id,
    slug: ws.slug,
    name: ws.name,
    ownerUserId: ws.ownerUserId ?? '',
    icon: ws.icon ?? null,
    color: ws.color ?? null,
  };
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
