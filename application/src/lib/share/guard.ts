/**
 * Một cửa duy nhất cho mọi bề mặt /share công khai.
 *
 * Vì sao phải gom: gate visibility từng được viết riêng ngay trong
 * `share/[slug]/page.tsx`, nên khi thêm trang node và endpoint OG thì hai bề
 * mặt mới KHÔNG có gate. Rà 2026-08-21 dựng lại được bằng curl ẩn danh:
 * `/share/<slug-private>` trả 404 đúng, nhưng
 * `/share/<slug-private>/n/<node>` trả 200 kèm đầy đủ nội dung, và
 * `/api/og?slug=<slug-private>` trả PNG. Ba agent rà độc lập cùng ra kết quả
 * này. Gate nằm rải là gate sẽ bị bỏ sót ở bề mặt tiếp theo.
 *
 * Quy tắc: bề mặt share nào cũng phải đi qua `resolveShareableWorkspace`.
 * Không tìm thấy và không đủ quyền trả về CÙNG một kết quả (`null`) để người
 * ngoài không dò được slug nào tồn tại.
 */
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { workspaces, workspaceMembers } from '@/lib/db/schema';

export type ShareableWorkspace = typeof workspaces.$inferSelect;

/** Owner hoặc member của workspace private được xem; ngoài ra không. */
async function isViewerAllowed(
  workspaceId: string,
  ownerUserId: string | null,
  userId: string,
): Promise<boolean> {
  if (ownerUserId === userId) return true;
  const rows = await db
    .select({ userId: workspaceMembers.userId })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)))
    .limit(1);
  return rows.length > 0;
}

/**
 * Trả workspace nếu người xem được phép thấy bề mặt share của nó, ngược lại `null`.
 *
 * @param viewerId `null` khi ẩn danh. Truyền đúng người xem — truyền `null` cho
 *   người đã đăng nhập sẽ chặn nhầm owner khỏi chính workspace private của họ.
 */
export async function resolveShareableWorkspace(
  slug: string,
  viewerId: string | null,
): Promise<ShareableWorkspace | null> {
  const rows = await db.select().from(workspaces).where(eq(workspaces.slug, slug)).limit(1);
  const ws = rows[0];
  if (!ws) return null;
  if (ws.visibility === 'public-readonly') return ws;
  if (!viewerId) return null;
  return (await isViewerAllowed(ws.id, ws.ownerUserId, viewerId)) ? ws : null;
}

/**
 * Bản dành cho bề mặt được CACHE và crawler đọc (ảnh OG).
 *
 * Cố ý KHÔNG nhận người xem: ảnh OG cache ở edge một giờ và dùng chung cho mọi
 * người, nên nếu nó phụ thuộc vào người xem thì bản dựng cho owner sẽ được phục
 * vụ lại cho người lạ. Workspace private không có ảnh OG — cũng không cần, vì
 * trang tương ứng vốn đã 404 với người ngoài.
 */
export async function resolvePublicWorkspaceForCache(
  slug: string,
): Promise<ShareableWorkspace | null> {
  const rows = await db.select().from(workspaces).where(eq(workspaces.slug, slug)).limit(1);
  const ws = rows[0];
  return ws && ws.visibility === 'public-readonly' ? ws : null;
}
