/**
 * `level_source` của một kỹ năng — hợp nhất, thuần, test được.
 *
 * Bốn giá trị và quan hệ giữa chúng:
 *   self_claimed  người học tự nhận
 *   learned       hệ thống suy ra từ việc hoàn thành bài học
 *   both          có cả hai
 *   verified      người có quyền đã duyệt bằng chứng — CAO NHẤT
 *
 * Vì sao phải gom về một chỗ: cùng một quy tắc từng được viết lại ba lần và
 * hai bản trong đó hạ cấp dữ liệu (rà 2026-08-21 · B6.4):
 *   - `assessments.ts` ghi đè `self_claimed` VÔ ĐIỀU KIỆN. Drawer kỹ năng lại
 *     tự lưu sau 700ms, nên chỉ cần gõ một chữ vào ô ghi chú là `verified`
 *     biến mất — cùng với +30 XP đã trả cho lần duyệt đó.
 *   - `crowns.ts` chỉ xét đúng nhánh `self_claimed`, mọi giá trị khác (kể cả
 *     `verified`) đều bị ghi thành `learned`.
 *
 * Bất biến: **không sự kiện nào được hạ cấp `verified`.** Muốn gỡ duyệt thì
 * phải là một hành động riêng, cố ý, có ghi audit — không phải tác dụng phụ
 * của việc sửa ghi chú.
 */
export type LevelSource = 'self_claimed' | 'learned' | 'both' | 'verified';

/** Việc vừa xảy ra, không phải trạng thái muốn có. */
export type LevelSourceEvent =
  /** Người học tự đánh giá (sửa cấp độ / ghi chú / bằng chứng). */
  | 'self_assess'
  /** Hệ thống ghi nhận đã học xong (crowns, hoàn thành bài). */
  | 'learn'
  /** Người có quyền duyệt bằng chứng. */
  | 'verify';

export function nextLevelSource(
  prev: LevelSource | null,
  event: LevelSourceEvent,
): LevelSource {
  if (event === 'verify') return 'verified';
  // Đã duyệt thì mọi sự kiện thường đều không đụng tới được.
  if (prev === 'verified') return 'verified';

  if (event === 'self_assess') {
    // Đã có dấu vết "học" thì thành "cả hai"; ngược lại là tự nhận.
    return prev === 'learned' || prev === 'both' ? 'both' : 'self_claimed';
  }
  // event === 'learn'
  return prev === 'self_claimed' || prev === 'both' ? 'both' : 'learned';
}
