/**
 * Định dạng ngày giờ — MỘT nơi duy nhất.
 *
 * Vì sao gom: 8 chỗ gọi `toLocaleDateString()` / `toLocaleString()` **không
 * truyền locale**, nên kết quả phụ thuộc môi trường chạy. Đo trên máy này ra
 * `8/20/2026, 11:47:37 AM` — định dạng Mỹ giữa một app khai `lang="vi"`.
 *
 * Nguy hiểm hơn nhãn sai: Server Component và trình duyệt có thể có locale/múi
 * giờ khác nhau, nên cùng một `Date` render ra hai chuỗi khác nhau ⇒ **lệch
 * hydration**. Ghim cứng `vi-VN` + `Asia/Ho_Chi_Minh` làm hai phía luôn khớp.
 *
 * Múi giờ khớp với `todayVN()` ở `lib/gamification/streak.ts` — cùng một định
 * nghĩa "hôm nay" cho cả hiển thị lẫn nghiệp vụ.
 */
const TZ = 'Asia/Ho_Chi_Minh';
const LOCALE = 'vi-VN';

function toDate(v: Date | string | number): Date {
  return v instanceof Date ? v : new Date(v);
}

/** `20/08/2026` */
export function formatDateVN(v: Date | string | number): string {
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(toDate(v));
}

/**
 * `20/08/2026 23:47`
 *
 * Ghép tay thay vì để `Intl` tự sắp, vì locale `vi-VN` trả về dạng
 * `23:47 20/08/2026` (giờ trước ngày). Trong nhật ký kiểm toán và bảng danh
 * sách, ngày đứng trước dễ quét mắt hơn — và thứ tự cố định thì test được.
 */
export function formatDateTimeVN(v: Date | string | number): string {
  const d = toDate(v);
  const time = new Intl.DateTimeFormat(LOCALE, {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
  return `${formatDateVN(d)} ${time}`;
}

/** `Thứ Tư, 20 tháng 8` — dùng cho tiêu đề trang Hôm nay. */
export function formatDayHeadingVN(v: Date | string | number): string {
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: TZ,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(toDate(v));
}

/** `1.234` — số có dấu phân cách nhóm theo kiểu Việt. */
export function formatNumberVN(n: number): string {
  return new Intl.NumberFormat(LOCALE).format(n);
}

/**
 * Khoảng thời gian tương đối, bằng tiếng Việt.
 *
 * Nhận `now` để test được mà không phải giả lập đồng hồ.
 */
export function relativeTimeVN(
  v: Date | string | number,
  now: Date | number = Date.now(),
): string {
  const d = toDate(v);
  const nowMs = now instanceof Date ? now.getTime() : now;
  const diffMs = nowMs - d.getTime();

  // Mốc tương lai (lệch đồng hồ, hoặc ngày hẹn) — đừng nói "x phút trước".
  if (diffMs < 0) return formatDateVN(d);

  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return 'vừa xong';
  if (min < 60) return `${min} phút trước`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} giờ trước`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days} ngày trước`;
  return formatDateVN(d);
}
