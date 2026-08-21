/**
 * schema-certificates.ts — bảng `certificates` (Flow G, audit items G8/G10/G12).
 *
 * Mỗi workspace + người học có tối đa MỘT dòng chứng nhận (unique
 * workspace_id + subject_user_id). Dòng được upsert khi trang certificate
 * render một subject đủ điều kiện (≥80%): pct/counts cập nhật theo lần xem
 * mới nhất, còn `issued_at` giữ nguyên ngày cấp ĐẦU TIÊN (G5 — ngày thật,
 * không phải ngày xem).
 *
 * `unique_code`: mã ngẫu nhiên url-safe (base32 từ crypto) — vừa là khóa
 * tra cứu công khai cho route /cert/[code] (G10), vừa là payload của QR
 * in trên tờ chứng nhận (G8). Mã chính là bí mật: biết mã = xem được trang
 * xác thực.
 *
 * `revoked_at`: nullable — thu hồi chứng nhận (route công khai sẽ từ chối
 * xác thực khi có giá trị).
 *
 * Workspace-scoped: mọi query phải lọc theo `workspaceId` (guard tự suy ra
 * vì cột này tồn tại). Ngoại lệ duy nhất: lookup công khai theo `unique_code`
 * — global-by-secret, có line-allow comment tại chỗ dùng.
 */
import { sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';

export const certificates = pgTable(
  'certificates',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid('workspace_id').notNull(),
    subjectUserId: uuid('subject_user_id').notNull(),
    /** Phần trăm hoàn thành lúc gần nhất trang cert được xem (0–100). */
    pct: integer('pct').notNull(),
    doneCount: integer('done_count').notNull(),
    totalNodes: integer('total_nodes').notNull(),
    issuedAt: timestamp('issued_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** Mã xác thực công khai, url-safe base32, VÍ DỤ `7Q4JB9XK2M`. */
    uniqueCode: text('unique_code').notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('certificates_workspace_subject_uq').on(
      t.workspaceId,
      t.subjectUserId,
    ),
    uniqueIndex('certificates_unique_code_uq').on(t.uniqueCode),
    index('certificates_workspace_idx').on(t.workspaceId),
  ],
);
