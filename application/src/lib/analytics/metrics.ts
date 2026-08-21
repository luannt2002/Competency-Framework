/**
 * Pure math/formatting helpers for creator learning analytics (Flow C5).
 *
 * No DB, no React — everything here is unit-testable pure functions so the
 * page components stay thin. Thresholds are SSoT'd here instead of being
 * scattered across queries and UI.
 */

/** Số giờ/ms trong một ngày UTC. */
export const DAY_MS = 86_400_000;

/**
 * Ngày (UTC, làm tròn xuống) từ `d` đến `now`.
 * Dùng làm tròn xuống để "6 ngày 23 giờ" vẫn là 6 ngày.
 */
export function daysSince(d: Date, now: Date = new Date()): number {
  return Math.floor((now.getTime() - d.getTime()) / DAY_MS);
}

/**
 * Phần trăm hoàn thành (0-100, làm tròn). total <= 0 → 0 — không bao giờ
 * chia cho 0 khi learner chưa có node nào để học.
 */
export function pct(done: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((done / total) * 100);
}

/** Trung bình cộng phần trăm của một danh sách (0 khi rỗng). */
export function avgPct(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((a, v) => a + v, 0) / values.length);
}

/**
 * SSoT cho định nghĩa "stuck" (C5.2): learner đã bắt đầu một node (có
 * progress row bất kể todo/doing) nhưng chưa done VÀ progress row đó không
 * được cập nhật lại trong >= STUCK_AFTER_DAYS ngày.
 *
 * `lastUpdate` là `user_node_progress.updated_at` — thời điểm learner chạm
 * vào node đó lần cuối (đổi status, thêm evidence, ...).
 */
export const STUCK_AFTER_DAYS = 7;

/** Pure predicate: progress row này có bị coi là stuck không? */
export function isStuckRow(
  status: string | null | undefined,
  lastUpdate: Date | null | undefined,
  now: Date = new Date(),
  thresholdDays: number = STUCK_AFTER_DAYS,
): boolean {
  if (!status || status === 'done' || status === 'skipped') return false;
  if (!lastUpdate) return false;
  return daysSince(lastUpdate, now) >= thresholdDays;
}

/**
 * Tính điểm "stuck score" của một node: stuck / started (0-100).
 * Dùng để sort top-N stuck nodes — node có 2/3 learner stuck đáng chú ý
 * hơn node có 2/50.
 */
export function stuckScore(stuck: number, started: number): number {
  if (started <= 0) return 0;
  return Math.round((stuck / started) * 100);
}

/**
 * Build breadcrumb "Root › Phase › ... › Node" từ materialized pathStr
 * ("<uuid>/<uuid>/...") và bản đồ id → title của workspace.
 *
 * Segment nào không có trong map (node đã xoá) bị bỏ qua im lặng —
 * analytics không nên crash vì dữ liệu mồ côi.
 */
export function buildBreadcrumb(
  nodeId: string,
  pathStr: string,
  titlesById: Map<string, string>,
  maxSegments = 4,
): string {
  const ids = pathStr
    .split('/')
    .filter(Boolean)
    .filter((id) => id !== nodeId);
  const parts: string[] = [];
  for (const id of ids) {
    const t = titlesById.get(id);
    if (t) parts.push(t);
  }
  const self = titlesById.get(nodeId);
  if (self) parts.push(self);
  if (parts.length === 0) return self ?? nodeId;
  // Giữ segment đầu (root context) + đoạn đuôi gần node nhất.
  let shown = parts;
  if (parts.length > maxSegments) {
    shown = [parts[0] ?? '…', '…', ...parts.slice(-(maxSegments - 2))];
  }
  return shown.join(' › ');
}

/** Format "3d" / "2w" cho số ngày idle — ngắn gọn cho chip trong UI. */
export function formatIdleDays(days: number): string {
  if (days < 0) return '0d';
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w`;
  return `${Math.floor(days / 30)}mo`;
}
