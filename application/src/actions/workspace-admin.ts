/**
 * Workspace admin server actions — OWNER-only.
 *
 * Backs the `/w/[slug]/settings` admin surface (rename, visibility toggle,
 * delete). Same resolve-then-RBAC pattern as `workspace-members.ts` so a
 * non-owner or unknown slug surfaces a unified error.
 *
 * Audit actions written here:
 *   - workspace.rename
 *   - workspace.visibility_update
 *   - workspace.delete
 *
 * NOTE: `workspaces.visibility` is a pg enum of `'private' | 'public-readonly'`.
 * The UI uses the simpler labels "private" / "public"; we map "public" → the
 * stored 'public-readonly' value here so callers stay schema-agnostic.
 */
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { workspaces } from '@/lib/db/schema';
import { requireUser } from '@/lib/auth/supabase-server';
import { RBAC_LEVELS } from '@/lib/rbac/levels';
import { requireMinLevel, writeAudit, RBACError } from '@/lib/rbac/server';

async function resolveOwnerWorkspace(slug: string) {
  const user = await requireUser();
  const rows = await db
    .select({
      id: workspaces.id,
      slug: workspaces.slug,
      name: workspaces.name,
      visibility: workspaces.visibility,
    })
    .from(workspaces)
    .where(eq(workspaces.slug, slug))
    .limit(1);
  const ws = rows[0];
  if (!ws) throw new Error('WORKSPACE_NOT_FOUND_OR_FORBIDDEN');

  let ctx;
  try {
    ctx = await requireMinLevel(ws.id, RBAC_LEVELS.OWNER);
  } catch (err) {
    if (err instanceof RBACError) throw new Error('WORKSPACE_NOT_FOUND_OR_FORBIDDEN');
    throw err;
  }
  return { ws, user, ctx };
}

const renameInput = z.object({
  workspaceSlug: z.string(),
  name: z.string().min(1).max(80),
});

export async function renameWorkspace(workspaceSlug: string, name: string): Promise<void> {
  const parsed = renameInput.parse({ workspaceSlug, name });
  const { ws, user, ctx } = await resolveOwnerWorkspace(parsed.workspaceSlug);

  await db.update(workspaces).set({ name: parsed.name }).where(eq(workspaces.id, ws.id));

  await writeAudit({
    workspaceId: ws.id,
    actorUserId: user.id,
    actorRole: ctx.role,
    action: 'workspace.rename',
    resourceType: 'workspace',
    resourceId: ws.id,
    before: { name: ws.name },
    after: { name: parsed.name },
  });

  revalidatePath(`/w/${ws.slug}/settings`);
}

/** UI-friendly visibility values; mapped to DB enum internally. */
export type VisibilityValue = 'private' | 'public';

const visibilityInput = z.object({
  workspaceSlug: z.string(),
  value: z.enum(['private', 'public']),
});

export async function setWorkspaceVisibility(
  workspaceSlug: string,
  value: VisibilityValue,
): Promise<void> {
  const parsed = visibilityInput.parse({ workspaceSlug, value });
  const { ws, user, ctx } = await resolveOwnerWorkspace(parsed.workspaceSlug);

  const storedValue: 'private' | 'public-readonly' =
    parsed.value === 'private' ? 'private' : 'public-readonly';

  await db
    .update(workspaces)
    .set({ visibility: storedValue })
    .where(eq(workspaces.id, ws.id));

  await writeAudit({
    workspaceId: ws.id,
    actorUserId: user.id,
    actorRole: ctx.role,
    action: 'workspace.visibility_update',
    resourceType: 'workspace',
    resourceId: ws.id,
    before: { visibility: ws.visibility },
    after: { visibility: storedValue },
  });

  revalidatePath(`/w/${ws.slug}/settings`);
}

export async function deleteWorkspace(workspaceSlug: string): Promise<void> {
  const slug = z.string().parse(workspaceSlug);
  const { ws, user, ctx } = await resolveOwnerWorkspace(slug);

  // Audit FIRST — the workspace_id FK becomes NULL on delete (ON DELETE SET
  // NULL on audit_log.workspace_id), but the row is preserved.
  await writeAudit({
    workspaceId: ws.id,
    actorUserId: user.id,
    actorRole: ctx.role,
    action: 'workspace.delete',
    resourceType: 'workspace',
    resourceId: ws.id,
    before: { slug: ws.slug, name: ws.name, visibility: ws.visibility },
    after: null,
  });

  // Cascading deletes are configured on most workspace-scoped tables.
  await db.delete(workspaces).where(eq(workspaces.id, ws.id));

  revalidatePath('/');
  redirect('/');
}
