/**
 * Ngày tháng cho trình lập kế hoạch ngày — thuần, không IO, test được.
 *
 * Trước đây file này cắt ngày theo **UTC** trong khi streak cắt theo giờ Việt
 * Nam, nên từ 00:00 đến 07:00 giờ VN, planner vẫn coi là ngày hôm qua còn
 * streak đã sang ngày mới — lệch 7 tiếng mỗi ngày, mỗi ngày. Giờ cả hai lấy
 * chung một định nghĩa ở `@/lib/day-vn`.
 *
 * Tên hàm giữ nguyên để hơn 20 chỗ gọi không phải sửa; chỉ ý nghĩa múi giờ đổi.
 */
import { isoDateVN, todayVN, tomorrowVN, daysBetweenISO } from '@/lib/day-vn';

/** `yyyy-mm-dd` của một mốc thời gian, theo giờ Việt Nam. */
export function isoDate(d: Date): string {
  return isoDateVN(d);
}

/** `yyyy-mm-dd` của hôm nay, giờ Việt Nam. */
export function todayISO(): string {
  return todayVN();
}

/** `yyyy-mm-dd` của ngày mai, giờ Việt Nam. */
export function tomorrowISO(): string {
  return tomorrowVN();
}

/** Số ngày giữa hai chuỗi ISO (dương nghĩa là `b` sau `a`). */
export function daysBetween(aIso: string | null, bIso: string): number {
  return daysBetweenISO(aIso, bIso);
}
