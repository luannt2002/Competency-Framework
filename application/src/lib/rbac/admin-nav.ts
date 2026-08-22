/**
 * Sidebar admin-section visibility — pure mapping, no IO.
 *
 * Each admin nav item has a minimum effective RBAC level. The sidebar renders
 * an item only when `level >= required` (see `checkMinLevel` in ./levels).
 * Kept pure so it is unit-testable and reusable by both sidebar shells.
 */
import { RBAC_LEVELS, checkMinLevel } from './levels';

/**
 * Admin nav key → cấp tối thiểu để NHÌN THẤY mục đó.
 *
 * Bảng này phải khớp đúng cấp mà CHÍNH TRANG đó đòi, nếu không sidebar sẽ dẫn
 * người ta vào một trang đá họ ra:
 *   members   OWNER   ← `members/page.tsx:81`  requireMinLevel(OWNER)
 *   audit     OWNER   ← `audit/page.tsx:39`    requireMinLevel(OWNER)
 *   roster    EDITOR  ← `roster/page.tsx:76`
 *   analytics EDITOR  ← `analytics/page.tsx:60`
 *   grading   EDITOR  ← `grading/page.tsx:32`  resolveWorkspace(EDITOR)
 *   badges    EDITOR  ← `badges/page.tsx:40`
 *   settings  OWNER
 *
 * Rà 2026-08-21 tìm ra hai lệch: `members` và `audit` khai EDITOR ở đây nhưng
 * trang đòi OWNER ⇒ EDITOR thấy link, bấm vào nhận `NEXT_REDIRECT`. Và
 * `grading` + `badges` không có mặt trong bảng ⇒ hai trang chạy tốt nhưng
 * KHÔNG một `href` nào trong toàn bộ `*.tsx` trỏ tới.
 *
 * Thêm trang admin mới thì thêm dòng vào đây, nếu không nó thành route mồ côi.
 */
export const ADMIN_NAV_MIN_LEVELS = {
  members: RBAC_LEVELS.OWNER,
  audit: RBAC_LEVELS.OWNER,
  roster: RBAC_LEVELS.EDITOR,
  analytics: RBAC_LEVELS.EDITOR,
  grading: RBAC_LEVELS.EDITOR,
  badges: RBAC_LEVELS.EDITOR,
  settings: RBAC_LEVELS.OWNER,
} as const;

export type AdminNavKey = keyof typeof ADMIN_NAV_MIN_LEVELS;

/** Pure check: is `adminItem` visible at `level`? */
export function isAdminItemVisible(adminItem: AdminNavKey, level: number): boolean {
  return checkMinLevel(level, ADMIN_NAV_MIN_LEVELS[adminItem]);
}

/** All admin item keys visible at `level` (order stable, matches ADMIN_NAV_MIN_LEVELS). */
export function visibleAdminItems(level: number): AdminNavKey[] {
  return (Object.keys(ADMIN_NAV_MIN_LEVELS) as AdminNavKey[]).filter((k) =>
    isAdminItemVisible(k, level),
  );
}
