/**
 * Workspace member management server actions — OWNER-only.
 *
 * Backs the `/w/[slug]/members` admin surface. Uses the resolveWorkspace
 * pattern from `src/actions/tree-nodes.ts` so a non-owner / unknown slug
 * surfaces the same WORKSPACE_NOT_FOUND_OR_FORBIDDEN error (no existence
 * leak).
 *
 * Audit actions written here:
 *   - member.invite
 *   - member.role_update
 *   - member.remove
 *
 * For MVP we accept a user-id directly (UUID paste). A future iteration can
 * resolve email → user-id via Supabase admin API once we wire that up; the
 * `inviteWorkspaceMember` action accepts the raw identifier and best-effort
 * detects whether it looks like a UUID. Emails fall through with a clear
 * error so the UI can prompt the user to paste a UUID instead.
 */
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { workspaces, workspaceMembers } from '@/lib/db/schema';
import { requireUser } from '@/lib/auth/supabase-server';
import { RBAC_LEVELS } from '@/lib/rbac/levels';
import { requireMinLevel, writeAudit, RBACError } from '@/lib/rbac/server';

/** Internal: resolve workspace + enforce OWNER-min level (admin surface). */
async function resolveOwnerWorkspace(slug: string) {
  const user = await requireUser();
  const rows = await db
    .select({ id: workspaces.id, slug: workspaces.slug })
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

/** Roles the UI can assign via this admin surface. Owner is NOT assignable here. */
const assignableRole = z.enum(['learner', 'workspace_contributor', 'workspace_editor']);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const inviteInput = z.object({
  workspaceSlug: z.string(),
  /** For MVP this is a user-id (UUID). Future: email → user-id resolution. */
  identifier: z.string().min(1).max(200),
  role: assignableRole,
});

export async function inviteWorkspaceMember(
  workspaceSlug: string,
  identifier: string,
  role: z.infer<typeof assignableRole>,
): Promise<{ id: string }> {
  const parsed = inviteInput.parse({ workspaceSlug, identifier, role });
  const { ws, user, ctx } = await resolveOwnerWorkspace(parsed.workspaceSlug);

  const id = parsed.identifier.trim();
  if (!UUID_RE.test(id)) {
    // MVP: only UUIDs accepted. Surface a friendly error.
    throw new Error('INVALID_USER_ID:Paste the member user UUID. Email lookup not wired yet.');
  }

  // Already a member?
  const existing = await db
    .select({ id: workspaceMembers.id })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, ws.id), eq(workspaceMembers.userId, id)))
    .limit(1);
  if (existing[0]) throw new Error('ALREADY_MEMBER');

  const [inserted] = await db
    .insert(workspaceMembers)
    .values({
      workspaceId: ws.id,
      userId: id,
      role: parsed.role,
      invitedBy: user.id,
    })
    .returning({ id: workspaceMembers.id });
  if (!inserted) throw new Error('INSERT_FAILED');

  await writeAudit({
    workspaceId: ws.id,
    actorUserId: user.id,
    actorRole: ctx.role,
    action: 'member.invite',
    resourceType: 'workspace_member',
    resourceId: inserted.id,
    after: { userId: id, role: parsed.role },
  });

  revalidatePath(`/w/${ws.slug}/members`);
  return { id: inserted.id };
}

const updateRoleInput = z.object({
  workspaceSlug: z.string(),
  memberId: z.string().uuid(),
  role: assignableRole,
});

export async function updateMemberRole(
  workspaceSlug: string,
  memberId: string,
  role: z.infer<typeof assignableRole>,
): Promise<void> {
  const parsed = updateRoleInput.parse({ workspaceSlug, memberId, role });
  const { ws, user, ctx } = await resolveOwnerWorkspace(parsed.workspaceSlug);

  // Capture before-state. Tenant-scoped WHERE prevents cross-workspace updates.
  const beforeRows = await db
    .select({ userId: workspaceMembers.userId, role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(
      and(eq(workspaceMembers.id, parsed.memberId), eq(workspaceMembers.workspaceId, ws.id)),
    )
    .limit(1);
  const before = beforeRows[0];
  if (!before) throw new Error('MEMBER_NOT_FOUND');

  await db
    .update(workspaceMembers)
    .set({ role: parsed.role })
    .where(
      and(eq(workspaceMembers.id, parsed.memberId), eq(workspaceMembers.workspaceId, ws.id)),
    );

  await writeAudit({
    workspaceId: ws.id,
    actorUserId: user.id,
    actorRole: ctx.role,
    action: 'member.role_update',
    resourceType: 'workspace_member',
    resourceId: parsed.memberId,
    before: { role: before.role },
    after: { role: parsed.role },
  });

  revalidatePath(`/w/${ws.slug}/members`);
}

export async function removeMember(workspaceSlug: string, memberId: string): Promise<void> {
  const slug = z.string().parse(workspaceSlug);
  const id = z.string().uuid().parse(memberId);
  const { ws, user, ctx } = await resolveOwnerWorkspace(slug);

  const beforeRows = await db
    .select({ userId: workspaceMembers.userId, role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.id, id), eq(workspaceMembers.workspaceId, ws.id)))
    .limit(1);
  const before = beforeRows[0];
  if (!before) throw new Error('MEMBER_NOT_FOUND');

  await db
    .delete(workspaceMembers)
    .where(and(eq(workspaceMembers.id, id), eq(workspaceMembers.workspaceId, ws.id)));

  await writeAudit({
    workspaceId: ws.id,
    actorUserId: user.id,
    actorRole: ctx.role,
    action: 'member.remove',
    resourceType: 'workspace_member',
    resourceId: id,
    before: { userId: before.userId, role: before.role },
    after: null,
  });

  revalidatePath(`/w/${ws.slug}/members`);
}
