/**
 * join-pending-invites.ts — auto-join workspace khi đăng nhập lần đầu (D2.5).
 *
 * Người được mời bằng email nhưng CHƯA từng đăng nhập sẽ có dòng
 * `workspace_invites` ở trạng thái pending. File này chạy SAU khi auth thành
 * công (auth callback): nhận mọi invite pending khớp email → insert
 * workspace_members → đánh dấu accepted → ghi audit.
 *
 * Thiết kế:
 *  - IDEMPOTENT: chỉ chạm invite còn `pending`; insert member dùng
 *    ON CONFLICT DO NOTHING nên chạy lại không tạo trùng lặp.
 *  - NON-THROWING: mọi lỗi được nuốt + log — không bao giờ làm hỏng luồng
 *    đăng nhập vì phần auto-join thất bại.
 */
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { workspaceInvites } from '@/lib/db/schema-invites';
import { workspaceMembers } from '@/lib/db/schema-rbac';
import { writeAudit } from '@/lib/rbac/server';
import { normalizeEmail } from './invite-tokens';

export type AcceptedInvite = {
  inviteId: string;
  workspaceId: string;
  memberId: string;
  role: string;
};

/**
 * Chấp nhận mọi invite pending cho (userId, email). Trả về danh sách các
 * invite đã chấp nhận (rỗng khi không có / lỗi). Không throw.
 */
export async function acceptPendingInvites(
  userId: string,
  email: string | null | undefined,
): Promise<AcceptedInvite[]> {
  const out: AcceptedInvite[] = [];
  if (!userId || !email) return out;
  const key = normalizeEmail(email);

  try {
    // Global-by-email: đúng theo thiết kế — người dùng mới đăng nhập cần vào
    // MỌI workspace đã mời email của họ, không thể lọc theo một workspace.
    const pending = await db
      .select({
        id: workspaceInvites.id,
        workspaceId: workspaceInvites.workspaceId,
        role: workspaceInvites.role,
      })
      .from(workspaceInvites) // guard-tenant-scope: allow — global-by-email lookup
      .where(and(eq(workspaceInvites.email, key), eq(workspaceInvites.status, 'pending')));

    for (const invite of pending) {
      try {
        // Insert member idempotent — người dùng có thể đã là member do được
        // mời bằng UUID trong lúc invite pending còn tồn tại.
        const inserted = await db
          .insert(workspaceMembers)
          .values({
            // tenant column insert — workspaceId của chính invite này
            workspaceId: invite.workspaceId,
            userId,
            role: invite.role,
            invitedBy: null,
            joinedAt: new Date(),
          })
          .onConflictDoNothing({
            target: [workspaceMembers.workspaceId, workspaceMembers.userId],
          })
          .returning({ id: workspaceMembers.id });

        const alreadyMember = !inserted[0];
        const memberId = inserted[0]?.id ?? null;

        // Đánh dấu accepted dù đã là member (invite đã hoàn thành sứ mệnh).
        await db
          .update(workspaceInvites)
          .set({
            status: 'accepted',
            acceptedAt: new Date(),
            acceptedByUserId: userId,
          })
          .where(
            and(
              eq(workspaceInvites.id, invite.id),
              eq(workspaceInvites.workspaceId, invite.workspaceId),
              eq(workspaceInvites.status, 'pending'),
            ),
          );

        // Audit: tái dùng action `member.invite` (payload mở rộng cho biết
        // đây là auto-join từ invite pending). Actor là chính người_accept.
        await writeAudit({
          workspaceId: invite.workspaceId,
          actorUserId: userId,
          actorRole: invite.role,
          action: 'member.invite',
          resourceType: 'workspace_member',
          resourceId: memberId,
          after: {
            userId,
            role: invite.role,
            autoJoinedFromInvite: invite.id,
            alreadyMember,
          },
        });

        if (memberId) {
          out.push({
            inviteId: invite.id,
            workspaceId: invite.workspaceId,
            memberId,
            role: invite.role,
          });
        }
      } catch (err) {
        console.error(`[acceptPendingInvites] invite ${invite.id} failed:`, err);
      }
    }
  } catch (err) {
    console.error('[acceptPendingInvites] lookup failed:', err);
  }
  return out;
}
