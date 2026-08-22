/**
 * Tổng XP kiếm được trong MỘT ngày (giờ Việt Nam) — cộng ở DB, không ở JS.
 *
 * Trước đợt này hai chỗ trong `actions/daily-planner.ts` kéo về TOÀN BỘ lịch sử
 * `xp_events` của người dùng rồi lọc "hôm nay" bằng `Array.filter`. Chi phí tăng
 * theo tuổi tài khoản: học một năm là hàng nghìn dòng chuyển qua mạng để tính
 * một phép cộng, mỗi lần mở trang Hôm nay.
 *
 * Ranh giới ngày phải khớp `isoDateVN` — cùng một quy ước cho cả sản phẩm, xem
 * chú thích ở `lib/day-vn.ts`. Ở đó phép tính là "cộng 7 tiếng rồi cắt theo
 * UTC"; biểu thức dưới đây làm đúng như vậy:
 *
 *   created_at AT TIME ZONE 'UTC'   → timestamp theo UTC (bỏ vỏ timestamptz)
 *   + interval '7 hours'            → dịch sang giờ VN
 *   ::date                          → cắt lấy ngày
 *
 * Dùng offset cố định thay vì `AT TIME ZONE 'Asia/Ho_Chi_Minh'` để bám sát bản
 * JS: Việt Nam không có giờ mùa hè nên hai cách cho cùng kết quả, nhưng viết
 * theo cùng phép tính thì hai bản không thể lệch nhau khi ai đó sửa một bên.
 */
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { xpEvents } from '@/lib/db/schema';

export async function sumXpOnDateVN(
  workspaceId: string,
  userId: string,
  /** `yyyy-mm-dd` theo giờ Việt Nam. */
  dateVN: string,
): Promise<number> {
  const [row] = await db
    .select({ total: sql<string | null>`SUM(${xpEvents.amount})` })
    .from(xpEvents)
    .where(
      and(
        eq(xpEvents.workspaceId, workspaceId),
        eq(xpEvents.userId, userId),
        sql`((${xpEvents.createdAt} AT TIME ZONE 'UTC') + interval '7 hours')::date = ${dateVN}::date`,
      ),
    );

  // `SUM` trả NULL khi không có dòng nào — không phải 0.
  return Number(row?.total ?? 0);
}
