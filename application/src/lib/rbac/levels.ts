/**
 * RBAC numeric level SSoT (Single Source of Truth).
 *
 * The application uses a 7-tier numeric model. A required level is just an
 * integer; an effective level is just an integer. `actual >= required` =
 * allowed. This keeps callsites trivial:
 *
 *   await requireMinLevel(workspaceId, RBAC_LEVELS.EDITOR)
 *
 * Roles map to levels. Aliases (e.g. "admin" → super_admin) are accepted for
 * forward compatibility with older grants; the canonical names are listed in
 * the `RoleName` union below.
 *
 * See:
 *   - docs/dev/RBAC_PERMISSIONS.md          (technical)
 *   - docs/business/PHAN_QUYEN.md           (Vietnamese business)
 *   - src/lib/rbac/server.ts                (resolver + guard)
 *   - src/lib/db/schema-rbac.ts             (workspace_members.role)
 */

/** Canonical role names. The DB stores one of these (or an alias). */
export type RoleName =
  | 'guest'
  | 'viewer'
  | 'learner'
  | 'workspace_contributor'
  | 'workspace_editor'
  | 'workspace_owner'
  | 'super_admin';

/**
 * Numeric levels — exported as a const object for convenience in call sites
 * that prefer named constants over magic numbers.
 */
export const RBAC_LEVELS = {
  GUEST: 0,
  VIEWER: 10,
  LEARNER: 20,
  CONTRIBUTOR: 40,
  EDITOR: 60,
  OWNER: 80,
  SUPER_ADMIN: 100,
} as const;

/**
 * Role-name → numeric-level lookup, including back-compat aliases.
 * Unknown strings resolve to 0 (guest) via `getRoleLevel`.
 */
export const ROLE_LEVELS: Record<string, number> = {
  // Canonical
  guest: RBAC_LEVELS.GUEST,
  viewer: RBAC_LEVELS.VIEWER,
  learner: RBAC_LEVELS.LEARNER,
  workspace_contributor: RBAC_LEVELS.CONTRIBUTOR,
  workspace_editor: RBAC_LEVELS.EDITOR,
  workspace_owner: RBAC_LEVELS.OWNER,
  super_admin: RBAC_LEVELS.SUPER_ADMIN,

  // Aliases — accepted on read, never written by our code
  anonymous: RBAC_LEVELS.GUEST,
  reader: RBAC_LEVELS.VIEWER,
  read_only: RBAC_LEVELS.VIEWER,
  student: RBAC_LEVELS.LEARNER,
  contributor: RBAC_LEVELS.CONTRIBUTOR,
  editor: RBAC_LEVELS.EDITOR,
  owner: RBAC_LEVELS.OWNER,
  admin: RBAC_LEVELS.SUPER_ADMIN,
  platform_admin: RBAC_LEVELS.SUPER_ADMIN,
};

/** Returns the numeric level for a role string. Unknown → 0 (guest). */
export function getRoleLevel(role: string | null | undefined): number {
  if (!role) return RBAC_LEVELS.GUEST;
  const lvl = ROLE_LEVELS[role.toLowerCase()];
  return typeof lvl === 'number' ? lvl : RBAC_LEVELS.GUEST;
}

/** Pure check: does `actualLevel` meet or exceed `required`? */
export function checkMinLevel(actualLevel: number, required: number): boolean {
  return actualLevel >= required;
}
