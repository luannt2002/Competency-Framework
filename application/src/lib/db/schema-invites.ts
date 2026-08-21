/**
 * schema-invites.ts — bảng `workspace_invites` (Flow D, audit item D2.5).
 *
 * VẤN ĐỀ NÀY GIẢI QUYẾT
 * --------------------
 * Trước đây invite bằng email chỉ hoạt động khi người được mời ĐÃ đăng nhập
 * ít nhất một lần (findUserIdByEmail mới tìm ra user). Người chưa có tài khoản
 * bị chặn với lỗi "cần đăng nhập trước" — nghịch lý: muốn vào thì phải được
 * mời, muốn được mời thì phải đã đăng nhập.
 *
 * CÁCH LÀM
 * --------
 * Khi email không resolve ra user: ghi một dòng `pending` vào đây thay vì
 * throw. Lần ĐẦU TIÊN người đó đăng nhập bằng đúng email, hook ở auth callback
 * (`src/lib/auth/join-pending-invites.ts`) tự insert workspace_members và
 * đánh dấu `accepted` — auto-join (D2.5).
 *
 * `invite_token`: mã ngẫu nhiên url-safe, base32 Crockford (cùng style với
 * `certificates.unique_code`) — dự phòng cho landing page /invite/<token>
 * (chưa làm; hiện chấp nhận qua auto-join khi đăng nhập).
 *
 * `status` là enum-as-text ('pending' | 'accepted' | 'revoked') — dùng text
 * thay vì pgEnum để không đụng bộ enum dùng chung (schema.ts không đổi).
 *
 * Unique (workspace_id, email) CHỈ trong số pending — partial unique index,
 * để sau khi accepted/revoked có thể mời lại cùng email.
 *
 * Workspace-scoped: mọi query phải lọc theo `workspaceId` (guard tự suy ra).
 * Ngoại lệ: lookup theo email khi người dùng đăng nhập — global-by-email, có
 * line-allow comment tại chỗ dùng (join-pending-invites.ts).
 */
import { sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  text,
  varchar,
  timestamp,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { workspaces } from './schema';

export const workspaceInvites = pgTable(
  'workspace_invites',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    /** Email người được mời, đã lowercase để so khớp tại login. */
    email: text('email').notNull(),
    /** Vai trò sẽ gán khi invite được chấp nhận. Không bao giờ là owner. */
    role: varchar('role', { length: 32 }).notNull().default('learner'),
    /** User (thường là owner) tạo lời mời. */
    invitedBy: uuid('invited_by'),
    /** Mã url-safe base32 Crockford — dự phòng cho /invite/<token>. */
    inviteToken: text('invite_token').notNull(),
    /** 'pending' | 'accepted' | 'revoked' — enum-as-text, không dùng pgEnum. */
    status: text('status').notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    /** User thật sau khi người được mời đăng nhập lần đầu. */
    acceptedByUserId: uuid('accepted_by_user_id'),
  },
  (t) => [
    // Chỉ một lời mời pending cho mỗi (workspace, email) — accepted/revoked
    // không chiếm chỗ, mời lại được.
    uniqueIndex('workspace_invites_ws_email_pending_uq')
      .on(t.workspaceId, t.email)
      .where(sql`status = 'pending'`),
    uniqueIndex('workspace_invites_token_uq').on(t.inviteToken),
    index('workspace_invites_ws_idx').on(t.workspaceId),
    index('workspace_invites_email_idx').on(t.email),
  ],
);

export type WorkspaceInvite = typeof workspaceInvites.$inferSelect;
export type NewWorkspaceInvite = typeof workspaceInvites.$inferInsert;
