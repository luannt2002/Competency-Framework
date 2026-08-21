/**
 * Sidebar admin-section visibility — pure mapping, no IO.
 *
 * Each admin nav item has a minimum effective RBAC level. The sidebar renders
 * an item only when `level >= required` (see `checkMinLevel` in ./levels).
 * Kept pure so it is unit-testable and reusable by both sidebar shells.
 */
import { RBAC_LEVELS, checkMinLevel } from './levels';

/** Admin nav key → minimum effective level required to see it. */
export const ADMIN_NAV_MIN_LEVELS = {
  members: RBAC_LEVELS.EDITOR,
  audit: RBAC_LEVELS.EDITOR,
  roster: RBAC_LEVELS.EDITOR,
  analytics: RBAC_LEVELS.EDITOR,
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
