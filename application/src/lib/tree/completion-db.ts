/**
 * Phép đếm tiến độ workspace — MỘT nguồn duy nhất.
 *
 * Vì sao phải gom: mỗi bề mặt từng tự đếm một kiểu, và hai kiểu đó ra hai con
 * số khác nhau cho cùng một người tại cùng một thời điểm (rà G12):
 *   - trang chứng nhận đếm node có `path_str <> ''` → mẫu số **164** → "85%"
 *   - trang share và dashboard đếm toàn bộ node       → mẫu số **166** → "84%"
 * Chứng nhận là thứ người học đem đi cho nhà tuyển dụng xem, kèm đúng một link
 * dẫn sang trang share. Hai con số đá nhau ngay trong luồng "không thể fake"
 * là hỏng đúng thứ luồng đó tồn tại để làm.
 *
 * Chốt: mẫu số là **toàn bộ node của workspace**, khớp với con số "N mục" mà
 * người dùng nhìn thấy trên chính trang đó.
 */
import { and, count, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { roadmapTreeNodes, userNodeProgress } from '@/lib/db/schema';
import { completionPct } from './completion';

export type WorkspaceCompletion = {
  done: number;
  total: number;
  pct: number;
};

/** Tổng số node dùng làm mẫu số cho mọi phép tính % của workspace. */
export async function totalCountableNodes(workspaceId: string): Promise<number> {
  const rows = await db
    .select({ n: count() })
    .from(roadmapTreeNodes)
    .where(eq(roadmapTreeNodes.workspaceId, workspaceId));
  return Number(rows[0]?.n ?? 0);
}

/** Tiến độ của MỘT người trong workspace, dùng chung mẫu số ở trên. */
export async function userWorkspaceCompletion(
  workspaceId: string,
  userId: string,
): Promise<WorkspaceCompletion> {
  const [total, doneRows] = await Promise.all([
    totalCountableNodes(workspaceId),
    db
      .select({ n: count() })
      .from(userNodeProgress)
      .where(
        and(
          eq(userNodeProgress.workspaceId, workspaceId),
          eq(userNodeProgress.userId, userId),
          eq(userNodeProgress.status, 'done'),
        ),
      ),
  ]);
  const done = Number(doneRows[0]?.n ?? 0);
  return { done, total, pct: completionPct(done, total) };
}
