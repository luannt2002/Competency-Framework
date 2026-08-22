/**
 * Workspace resolution + authorization helpers.
 *
 * MVP: a workspace is owned by a single user (workspaces.owner_user_id).
 * Future: org-owned (workspaces.org_id), see DESIGN_FUTURE.md.
 *
 * Mọi server action và page trong /w/[slug]/* PHẢI gọi `requireWorkspaceAccess(slug)`
 * trước khi truy vấn bất kỳ dữ liệu nào thuộc workspace.
 */
import { notFound, redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from './db/client';
import { workspaces } from './db/schema';
import { requireUser } from './auth/supabase-server';
import { resolveWorkspace } from './rbac/resolve';
import { RBAC_LEVELS } from './rbac/levels';

export type WorkspaceResolved = {
  id: string;
  slug: string;
  name: string;
  ownerUserId: string;
  /** Mô tả ngắn — hiện trên /share và thẻ /discover. */
  description: string | null;
  /** Emoji icon chosen by the owner (nullable). */
  icon: string | null;
  /** Accent color hex chosen by the owner (nullable, palette-whitelisted). */
  color: string | null;
  /** Chế độ hiển thị — trang Cài đặt cần để vẽ đúng trạng thái công tắc. */
  visibility: 'private' | 'public-readonly' | null;
  /**
   * Cấp quyền THẬT của người xem trong workspace này.
   *
   * Đây là lý do phải gộp hai resolver. Bản cũ chỉ kiểm `>= LEARNER` rồi vứt
   * kết quả đi, nên trang gọi nó **không biết người xem là ai**: trang node
   * render đủ nút Thêm con / Sửa / Xoá cho cả learner, bấm vào mới nhận
   * `WORKSPACE_NOT_FOUND_OR_FORBIDDEN` (rà B — đo bằng cookie vai learner).
   * Server chặn đúng, nhưng UI hứa một việc nó không cho làm.
   */
  level: number;
  role: string;
};

/**
 * Resolve workspace theo slug cho người dùng hiện tại.
 *
 * Nay là lớp mỏng bọc `resolveWorkspace` ở `./rbac/resolve` — MỘT resolver duy
 * nhất. Trước đây có hai bản song song, cùng truy vấn, cùng gọi
 * `requireMinLevel`, khác nhau ở chỗ bản này ghim cứng LEARNER và không trả
 * cấp quyền. Hai đường xác thực song song là hai cơ hội để chúng lệch nhau.
 *
 * Không-tìm-thấy và không-đủ-quyền vẫn cố ý không phân biệt được, để không dò
 * được slug nào tồn tại.
 */
export async function requireWorkspaceAccess(slug: string): Promise<WorkspaceResolved> {
  const { ws, ctx } = await resolveWorkspace(slug, RBAC_LEVELS.LEARNER);
  return {
    id: ws.id,
    slug: ws.slug,
    name: ws.name,
    ownerUserId: ws.ownerUserId ?? '',
    description: ws.description ?? null,
    icon: ws.icon ?? null,
    color: ws.color ?? null,
    visibility: ws.visibility ?? null,
    level: ctx.level,
    role: ctx.role,
  };
}

/**
 * Bản dành cho PAGE và LAYOUT: không đủ quyền hoặc không tồn tại đều ra 404.
 *
 * `requireWorkspaceAccess` ném `Error`, và không page nào bắt — nên người xem
 * không đủ quyền nhận **500** kèm nguyên văn `WORKSPACE_NOT_FOUND_OR_FORBIDDEN`
 * và đường dẫn tuyệt đối trong HTML (rà A11). Slug không tồn tại cũng 500.
 * Cả hai đều sai: đó là 404, và người dùng cần một trang có lối ra.
 *
 * KHÔNG dùng ở route handler — `notFound()` ném `NEXT_NOT_FOUND`, mà các route
 * đó bắt lỗi rồi map sang mã HTTP; ở đó `requireWorkspaceAccess` vẫn đúng vì
 * `mapErrorToResponse` đã map `WORKSPACE_NOT_FOUND_OR_FORBIDDEN` → 404.
 */
export async function requireWorkspacePage(slug: string): Promise<WorkspaceResolved> {
  try {
    return await requireWorkspaceAccess(slug);
  } catch (err) {
    if (err instanceof Error && err.message === 'WORKSPACE_NOT_FOUND_OR_FORBIDDEN') notFound();
    throw err;
  }
}

/**
 * Bản dành cho TRANG QUẢN TRỊ: đòi một cấp tối thiểu, hỏng thì đưa về đúng chỗ.
 *
 * Bảy trang (analytics · audit · badges · import · members · roster · settings)
 * đang chép tay cùng một khối: `requireUser` → tự truy vấn `workspaces` →
 * `requireMinLevel` → bắt `RBACError` → `redirect`. Bảy bản sao là bảy cơ hội
 * để chúng lệch nhau, và thực tế đã lệch: xem `ADMIN_NAV_MIN_LEVELS`.
 *
 * Hai lối ra khác nhau, có chủ đích:
 *   - **Không phải thành viên** (hoặc slug không tồn tại) → `notFound()`.
 *     Hai trường hợp này không phân biệt được, nên không dò được slug.
 *   - **Là thành viên nhưng chưa đủ cấp** → về trang chủ workspace. Họ vốn đã
 *     biết workspace này tồn tại, nên đưa họ về đó không lộ thêm gì, mà lại
 *     đúng việc hơn là ném ra 404.
 *
 * Bản cũ làm ngược: người ngoài bị `redirect('/w/<slug>')` rồi mới 404 ở chặng
 * sau — hai lần đi, và chặng đầu xác nhận slug có tồn tại.
 */
export async function requireAdminPage(
  slug: string,
  minLevel: number,
): Promise<WorkspaceResolved> {
  const ws = await requireWorkspacePage(slug);
  if (ws.level < minLevel) redirect(`/w/${ws.slug}`);
  return ws;
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
