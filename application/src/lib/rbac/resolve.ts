/**
 * Shared workspace resolution for server actions — SINGLE source of truth.
 *
 * Every action file used to carry its own copy of this helper (16 duplicates);
 * they are now unified here (DRY). Behaviour contract:
 *   - Resolves the workspace by slug (id, slug, name, ownerUserId).
 *   - Missing workspace and insufficient RBAC level are deliberately
 *     indistinguishable (WORKSPACE_NOT_FOUND_OR_FORBIDDEN) to prevent slug
 *     enumeration.
 *   - `resolveOwnerWorkspace` is the OWNER-min specialisation for admin
 *     surfaces (settings, members, import, …).
 *
 * Single Responsibility: authentication + tenant resolution only.
 * Actions keep: input validation (zod), business rules, persistence.
 */
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { workspaces } from '@/lib/db/schema';
import { requireUser } from '@/lib/auth/supabase-server';
import { RBAC_LEVELS } from './levels';
import { requireMinLevel, RBACError, type RBACContext } from './server';

export type ResolvedWorkspace = {
  id: string;
  slug: string;
  name: string;
  ownerUserId: string | null;
  visibility: 'private' | 'public-readonly' | null;
  /** Emoji do chủ workspace chọn (có thể trống). */
  icon: string | null;
  /** Màu nhấn do chủ workspace chọn — chỉ nhận giá trị trong bảng màu. */
  color: string | null;
};

export type ResolvedContext = {
  ws: ResolvedWorkspace;
  user: { id: string } & Awaited<ReturnType<typeof requireUser>>;
  ctx: RBACContext;
};

/** Resolve a workspace by slug and enforce a minimum RBAC level. */
export async function resolveWorkspace(
  slug: string,
  requiredLevel: number,
): Promise<ResolvedContext> {
  const user = await requireUser();
  const rows = await db
    .select({
      id: workspaces.id,
      slug: workspaces.slug,
      name: workspaces.name,
      ownerUserId: workspaces.ownerUserId,
      visibility: workspaces.visibility,
      // icon/color để vỏ workspace tô theo chủ đề riêng — trước đây chỉ
      // `requireWorkspaceAccess` lấy hai cột này, nên gộp hai resolver thì
      // resolver chuẩn phải biết chúng.
      icon: workspaces.icon,
      color: workspaces.color,
    })
    .from(workspaces)
    .where(eq(workspaces.slug, slug))
    .limit(1);
  const ws = rows[0];
  if (!ws) throw new Error('WORKSPACE_NOT_FOUND_OR_FORBIDDEN');
  try {
    const ctx = await requireMinLevel(ws.id, requiredLevel);
    return { ws, user, ctx };
  } catch (err) {
    if (err instanceof RBACError) throw new Error('WORKSPACE_NOT_FOUND_OR_FORBIDDEN');
    throw err;
  }
}

/** OWNER-only resolution for admin surfaces (settings, members, import). */
export async function resolveOwnerWorkspace(slug: string): Promise<ResolvedContext> {
  return resolveWorkspace(slug, RBAC_LEVELS.OWNER);
}
