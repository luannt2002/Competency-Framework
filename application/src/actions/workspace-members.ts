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
 *   - member.invite_bulk
 *   - member.role_update
 *   - member.remove
 *
 * Invite accepts email OR user-id (UUID). Email is resolved to a user via the
 * Supabase Admin API (`findUserIdByEmail`); the invitee must have signed in at
 * least once (auth-on-first-login invites need an invite-token system — see
 * PLAN 7.7 follow-up).
 */
'use server';
import { resolveOwnerWorkspace } from '@/lib/rbac/resolve';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { workspaceMembers } from '@/lib/db/schema';
import { writeAudit } from '@/lib/rbac/server';
import { findUserIdByEmail } from '@/lib/auth/user-display';

/** Internal: resolve workspace + enforce OWNER-min level (admin surface). */

/** Roles the UI can assign via this admin surface. Owner is NOT assignable here. */
const assignableRole = z.enum(['learner', 'workspace_contributor', 'workspace_editor']);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const inviteInput = z.object({
  workspaceSlug: z.string(),
  /** Email HOẶC user-id (UUID). Email được resolve qua Supabase Admin API. */
  identifier: z.string().min(1).max(200),
  role: assignableRole,
});

/** Email → user_id; UUID dùng thẳng. Báo lỗi thân thiện khi không tìm thấy. */
async function resolveIdentifier(raw: string): Promise<string> {
  const id = raw.trim();
  if (UUID_RE.test(id)) return id;
  if (id.includes('@')) {
    const userId = await findUserIdByEmail(id);
    if (!userId) {
      throw new Error(
        'USER_NOT_FOUND:Chưa tìm thấy tài khoản với email này. Người đó cần đăng nhập (bằng đúng email) ít nhất một lần trước khi được mời.',
      );
    }
    return userId;
  }
  throw new Error('INVALID_IDENTIFIER:Nhập email hoặc user UUID.');
}

export async function inviteWorkspaceMember(
  workspaceSlug: string,
  identifier: string,
  role: z.infer<typeof assignableRole>,
): Promise<{ id: string }> {
  const parsed = inviteInput.parse({ workspaceSlug, identifier, role });
  const { ws, user, ctx } = await resolveOwnerWorkspace(parsed.workspaceSlug);

  const id = await resolveIdentifier(parsed.identifier);

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
  // Never let the owner's own (legacy) member row be demoted through this
  // surface — ownership comes from workspaces.owner_user_id, demoting a member
  // row for the owner would create a contradictory authz state.
  if (ws.ownerUserId && before.userId === ws.ownerUserId) {
    throw new Error('MEMBER_IS_OWNER');
  }

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

/* ============================ BULK INVITE ============================ */

const bulkRow = z.object({
  userId: z.string(),
  role: assignableRole,
});

const bulkInput = z.object({
  workspaceSlug: z.string(),
  rows: z.array(bulkRow).min(1).max(500),
});

export type BulkInviteRowInput = z.infer<typeof bulkRow>;

export type BulkInviteResult = {
  added: number;
  skipped: number;
  errors: { index: number; userId: string; reason: string }[];
};

/**
 * Bulk invite many members at once. Each row is validated, deduplicated, and
 * either inserted, skipped (already a member or duplicate row in the batch),
 * or recorded as an error. Each successful insert writes a `member.invite_bulk`
 * audit row. Failures in individual rows do NOT abort the batch.
 */
export async function bulkInviteMembers(
  workspaceSlug: string,
  rows: BulkInviteRowInput[],
): Promise<BulkInviteResult> {
  const parsed = bulkInput.parse({ workspaceSlug, rows });
  const { ws, user, ctx } = await resolveOwnerWorkspace(parsed.workspaceSlug);

  const result: BulkInviteResult = { added: 0, skipped: 0, errors: [] };
  const seen = new Set<string>();

  for (let i = 0; i < parsed.rows.length; i++) {
    const row = parsed.rows[i]!;
    const raw = row.userId.trim();
    let id: string;
    try {
      id = await resolveIdentifier(raw);
    } catch (e) {
      // D2.2 — CSV có thể chứa email; resolve thất bại ghi reason rõ ràng.
      result.errors.push({
        index: i,
        userId: raw,
        reason: e instanceof Error ? e.message : 'INVALID_IDENTIFIER',
      });
      continue;
    }
    if (seen.has(id)) {
      result.skipped += 1;
      continue;
    }
    seen.add(id);

    try {
      // Insert with ON CONFLICT DO NOTHING — postgres-native idempotency.
      const inserted = await db
        .insert(workspaceMembers)
        .values({
          workspaceId: ws.id,
          userId: id,
          role: row.role,
          invitedBy: user.id,
        })
        .onConflictDoNothing({
          target: [workspaceMembers.workspaceId, workspaceMembers.userId],
        })
        .returning({ id: workspaceMembers.id });

      if (inserted[0]) {
        result.added += 1;
        await writeAudit({
          workspaceId: ws.id,
          actorUserId: user.id,
          actorRole: ctx.role,
          action: 'member.invite_bulk',
          resourceType: 'workspace_member',
          resourceId: inserted[0].id,
          after: { userId: id, role: row.role },
        });
      } else {
        result.skipped += 1;
      }
    } catch (e) {
      result.errors.push({
        index: i,
        userId: id,
        reason: e instanceof Error ? e.message : 'INSERT_FAILED',
      });
    }
  }

  revalidatePath(`/w/${ws.slug}/members`);
  return result;
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
  // Guard: the workspace owner must never be removable via the member admin
  // surface (ownership is stored on workspaces.owner_user_id and the workspace
  // would be orphaned with no admin able to manage it).
  if (ws.ownerUserId && before.userId === ws.ownerUserId) {
    throw new Error('MEMBER_IS_OWNER');
  }

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
