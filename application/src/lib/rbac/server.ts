/**
 * Server-side RBAC resolver + guards.
 *
 * This module is `server-only`: never import it from a Client Component.
 *
 * Entry points:
 *   - getEffectiveLevel(workspaceId, userId) — pure lookup, no throws
 *   - requireMinLevel(workspaceId, requiredLevel) — guard for server actions
 *   - writeAudit(entry)                          — append to audit_log
 *   - class RBACError                            — { code: 'FORBIDDEN' | 'UNAUTHORIZED' }
 *
 * Resolution order in getEffectiveLevel:
 *   1. userId null         → guest (0)
 *   2. dev-bypass user     → super_admin (100, dev/test only)
 *   3. PLATFORM_ADMIN_USER_IDS contains userId → super_admin (100)
 *   4. workspaceId provided + workspaces.owner_user_id = userId → workspace_owner (80)
 *   5. workspace_members row for (workspace_id, user_id) → member.role level
 *   6. Otherwise (logged-in but not a member) → viewer (10)
 *
 * The owner check in step 4 is independent of workspace_members: an owner row
 * is implied, never stored. This keeps the workspaces table the SSoT for
 * ownership and avoids drift.
 *
 * See docs/dev/RBAC_PERMISSIONS.md §3-§5.
 */
// server-only: this module touches the DB and reads env secrets. Importing
// it from a Client Component should be impossible because it pulls in
// `@/lib/db/client` (which uses `postgres` and DATABASE_URL). If `next` ever
// transitively provides the `server-only` shim, we can swap this for
// `import 'server-only';` at the top.
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { workspaces, workspaceMembers, auditLog } from '@/lib/db/schema';
import { getCurrentUser } from '@/lib/auth/supabase-server';
import { RBAC_LEVELS, getRoleLevel, checkMinLevel, type RoleName } from './levels';

export type EffectiveRole = {
  level: number;
  /** Canonical role name. */
  role: RoleName;
};

export class RBACError extends Error {
  code: 'FORBIDDEN' | 'UNAUTHORIZED';
  constructor(code: 'FORBIDDEN' | 'UNAUTHORIZED', message?: string) {
    super(message ?? code);
    this.code = code;
    this.name = 'RBACError';
  }
}

function isPlatformAdmin(userId: string): boolean {
  const raw = process.env.PLATFORM_ADMIN_USER_IDS ?? '';
  if (!raw.trim()) return false;
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .includes(userId);
}

function isDevBypassSuper(userId: string): boolean {
  // Dev convenience: the dev-bypass user is treated as super_admin so local
  // development with DEV_AUTH_BYPASS_USER_ID doesn't need PLATFORM_ADMIN_USER_IDS.
  // Hard-gated by NODE_ENV so a production build never grants super_admin via this.
  if (process.env.NODE_ENV === 'production') return false;
  const bypass = process.env.DEV_AUTH_BYPASS_USER_ID;
  return !!bypass && bypass === userId;
}

/**
 * Resolve the effective level + canonical role for a user against a workspace.
 *
 * `workspaceId` may be null when checking a platform-level action (e.g.
 * super_admin gates). In that case the resolver only considers super_admin
 * status and logged-in viewer fallback.
 */
export async function getEffectiveLevel(
  workspaceId: string | null,
  userId: string | null,
): Promise<EffectiveRole> {
  // 1. Guest
  if (!userId) return { level: RBAC_LEVELS.GUEST, role: 'guest' };

  // 2 + 3. Super admin (dev-bypass shortcut or env allowlist)
  if (isDevBypassSuper(userId) || isPlatformAdmin(userId)) {
    return { level: RBAC_LEVELS.SUPER_ADMIN, role: 'super_admin' };
  }

  // No workspace scope → logged-in viewer
  if (!workspaceId) return { level: RBAC_LEVELS.VIEWER, role: 'viewer' };

  // 4. Workspace owner — read directly from workspaces.owner_user_id
  const wsRows = await db
    .select({ ownerUserId: workspaces.ownerUserId })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);
  const ws = wsRows[0];
  if (ws?.ownerUserId === userId) {
    return { level: RBAC_LEVELS.OWNER, role: 'workspace_owner' };
  }

  // 5. Explicit workspace_members grant
  const memberRows = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, userId),
      ),
    )
    .limit(1);
  const member = memberRows[0];
  if (member) {
    const level = getRoleLevel(member.role);
    // Coerce stored alias back to canonical name when known
    const canonical = canonicalRoleForLevel(level, member.role);
    return { level, role: canonical };
  }

  // 6. Logged-in non-member → viewer (page-level reads still need their own
  //    gate, e.g. visibility checks; this just means RBAC won't grant more
  //    than read access).
  return { level: RBAC_LEVELS.VIEWER, role: 'viewer' };
}

function canonicalRoleForLevel(level: number, raw: string): RoleName {
  switch (level) {
    case RBAC_LEVELS.SUPER_ADMIN:
      return 'super_admin';
    case RBAC_LEVELS.OWNER:
      return 'workspace_owner';
    case RBAC_LEVELS.EDITOR:
      return 'workspace_editor';
    case RBAC_LEVELS.CONTRIBUTOR:
      return 'workspace_contributor';
    case RBAC_LEVELS.LEARNER:
      return 'learner';
    case RBAC_LEVELS.VIEWER:
      return 'viewer';
    case RBAC_LEVELS.GUEST:
      return 'guest';
    default:
      // Unknown alias — fall back to learner so we never silently elevate
      return raw.toLowerCase() === 'learner' ? 'learner' : 'learner';
  }
}

export type RBACContext = {
  user: { id: string };
  level: number;
  role: RoleName;
  workspaceId: string | null;
};

/**
 * Guard for server actions / route handlers.
 *
 * Throws `RBACError('UNAUTHORIZED')` if level > 0 is required but no user is
 * signed in. Throws `RBACError('FORBIDDEN')` if the user is signed in but
 * their effective level is below `requiredLevel`.
 *
 * The returned object is intentionally minimal: `user` is just `{ id }` to
 * avoid leaking the broader Supabase User shape into RBAC consumers.
 */
export async function requireMinLevel(
  workspaceId: string | null,
  requiredLevel: number,
): Promise<RBACContext> {
  const u = await getCurrentUser();
  const userId = u?.id ?? null;

  // Guest endpoints are allowed when required is 0
  if (requiredLevel > RBAC_LEVELS.GUEST && !userId) {
    throw new RBACError('UNAUTHORIZED');
  }

  const eff = await getEffectiveLevel(workspaceId, userId);
  if (!checkMinLevel(eff.level, requiredLevel)) {
    throw new RBACError('FORBIDDEN');
  }
  return {
    user: { id: userId ?? '' },
    level: eff.level,
    role: eff.role,
    workspaceId,
  };
}

export type AuditEntry = {
  workspaceId?: string | null;
  actorUserId: string;
  actorRole: string;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  before?: unknown;
  after?: unknown;
};

/**
 * Append a row to audit_log. Failures are swallowed (logged to console) — the
 * caller's primary mutation should not be rolled back because the audit
 * append failed. The DB constraint set is intentionally permissive (nullable
 * actor, nullable resource_id) so we never lose an audit row to a NOT NULL
 * violation.
 */
export async function writeAudit(entry: AuditEntry): Promise<void> {
  try {
    await db.insert(auditLog).values({
      workspaceId: entry.workspaceId ?? null,
      actorUserId: entry.actorUserId,
      actorRole: entry.actorRole,
      action: entry.action,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId ?? null,
      before: (entry.before ?? null) as never,
      after: (entry.after ?? null) as never,
    });
  } catch (err) {
    console.error('[rbac.writeAudit] failed:', err);
  }
}
