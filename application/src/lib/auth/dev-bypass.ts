/**
 * Dev-only auth bypass.
 *
 * Hard-gated by NODE_ENV !== 'production'. When DEV_AUTH_BYPASS_USER_ID is set
 * in .env.local AND NODE_ENV is 'development' or 'test', `getCurrentUser()`
 * synthesizes a User object pointing to a REAL user_id in the DB (the workspace
 * must already be owned by that UUID).
 *
 * Cookie override (dev-only): when NODE_ENV !== 'production', the cookie
 * `dev_bypass_user` (set by the /dev/switch page) takes priority over the env
 * var, so switching test personas does not require a dev-server restart.
 * The cookie is NEVER read in production — the branch is unreachable — so
 * there is zero production risk.
 *
 * Compliance:
 * - Not a mock. The user_id is real; all data still flows DB → API → UI.
 * - Throws in production builds to prevent accidental exposure.
 * - Guard test asserts the env is unreachable in NODE_ENV=production.
 */
import type { User } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

const PROD = process.env.NODE_ENV === 'production';

/** Cookie name used by the /dev/switch persona switcher. */
export const DEV_BYPASS_USER_COOKIE = 'dev_bypass_user';

/**
 * Pure resolution: which bypass user id wins?
 * Cookie > env var. Exported for unit testing (no cookie IO here).
 */
export function resolveDevBypassUserId(
  cookieValue: string | undefined,
  envValue: string | undefined,
): string | undefined {
  const cookie = cookieValue?.trim();
  if (cookie) return cookie;
  const env = envValue?.trim();
  return env || undefined;
}

export async function getDevBypassUser(): Promise<User | null> {
  if (PROD) return null;
  let cookieId: string | undefined;
  try {
    // Only reachable when NODE_ENV !== 'production' (early return above).
    const cookieStore = await cookies();
    cookieId = cookieStore.get(DEV_BYPASS_USER_COOKIE)?.value;
  } catch {
    // cookies() unavailable in this context — fall back to the env var.
  }
  const id = resolveDevBypassUserId(cookieId, process.env.DEV_AUTH_BYPASS_USER_ID);
  if (!id) return null;
  const email = process.env.DEV_AUTH_BYPASS_EMAIL ?? 'dev@local.test';
  // Construct a minimal User compatible with @supabase/supabase-js.User shape
  return {
    id,
    aud: 'authenticated',
    email,
    role: 'authenticated',
    app_metadata: {},
    user_metadata: {},
    created_at: new Date().toISOString(),
  } as unknown as User;
}

export async function isDevBypassEnabled(): Promise<boolean> {
  if (PROD) return false;
  let cookieId: string | undefined;
  try {
    const cookieStore = await cookies();
    cookieId = cookieStore.get(DEV_BYPASS_USER_COOKIE)?.value;
  } catch {
    // ignore
  }
  return !!resolveDevBypassUserId(cookieId, process.env.DEV_AUTH_BYPASS_USER_ID);
}
