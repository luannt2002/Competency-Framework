/**
 * "Hôm nay" — MỘT định nghĩa duy nhất cho cả sản phẩm.
 *
 * Người dùng ở Việt Nam, nên ranh giới ngày là **Asia/Ho_Chi_Minh** (UTC+7,
 * không có giờ mùa hè). Cắt theo UTC nghĩa là ngày mới bắt đầu lúc 07:00 sáng
 * giờ Việt Nam — streak reset giữa buổi sáng, kế hoạch hôm nay vẫn là kế hoạch
 * hôm qua cho tới 7 giờ.
 *
 * Lỗi đã xảy ra thật (rà 2026-08-21): `streak.ts` cắt theo giờ VN còn
 * `planner-dates.ts` và ô "XP hôm nay" trên topbar cắt theo UTC — **lệch 7
 * tiếng mỗi ngày**. Cùng một người, cùng một lúc, hai màn hình nói hai ngày
 * khác nhau. Mọi nơi cần "hôm nay" phải lấy từ đây.
 */

/** Lệch cố định của Asia/Ho_Chi_Minh. Không có giờ mùa hè nên hằng số là đủ. */
export const VN_TZ_OFFSET_MS = 7 * 60 * 60 * 1000;

/** `yyyy-mm-dd` của một mốc thời gian, theo giờ Việt Nam. */
export function isoDateVN(d: Date | number = Date.now()): string {
  const ms = d instanceof Date ? d.getTime() : d;
  return new Date(ms + VN_TZ_OFFSET_MS).toISOString().slice(0, 10);
}

/** `yyyy-mm-dd` của hôm nay, giờ Việt Nam. */
export function todayVN(): string {
  return isoDateVN();
}

/** `yyyy-mm-dd` của N ngày trước hôm nay, giờ Việt Nam. */
export function isoDaysAgoVN(n: number): string {
  return isoDateVN(Date.now() - n * 86_400_000);
}

/** `yyyy-mm-dd` của ngày mai, giờ Việt Nam. */
export function tomorrowVN(): string {
  return isoDateVN(Date.now() + 86_400_000);
}

/**
 * Mốc `Date` ứng với 00:00 giờ Việt Nam của một ngày ISO.
 *
 * Dùng cho các truy vấn `WHERE created_at >= ?`: cột lưu timestamptz nên phải
 * so với một mốc tuyệt đối, không so với chuỗi ngày.
 */
export function startOfDayVN(iso: string = todayVN()): Date {
  return new Date(Date.parse(`${iso}T00:00:00Z`) - VN_TZ_OFFSET_MS);
}

/** Số ngày giữa hai chuỗi ISO (dương nghĩa là `b` sau `a`). */
export function daysBetweenISO(aIso: string | null, bIso: string): number {
  if (!aIso) return Number.POSITIVE_INFINITY;
  const a = Date.parse(`${aIso}T00:00:00Z`);
  const b = Date.parse(`${bIso}T00:00:00Z`);
  return Math.floor((b - a) / 86_400_000);
}
