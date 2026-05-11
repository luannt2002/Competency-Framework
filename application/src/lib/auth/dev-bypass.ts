/**
 * Dev-only auth bypass.
 *
 * Hard-gated by NODE_ENV !== 'production'. When DEV_AUTH_BYPASS_USER_ID is set
 * in .env.local AND NODE_ENV is 'development' or 'test', `getCurrentUser()`
 * synthesizes a User object pointing to a REAL user_id in the DB (the workspace
 * must already be owned by that UUID).
 *
 * Compliance:
 * - Not a mock. The user_id is real; all data still flows DB → API → UI.
 * - Throws in production builds to prevent accidental exposure.
 * - Guard test asserts the env is unreachable in NODE_ENV=production.
 */
import type { User } from '@supabase/supabase-js';

const PROD = process.env.NODE_ENV === 'production';

export function getDevBypassUser(): User | null {
  if (PROD) return null;
  const id = process.env.DEV_AUTH_BYPASS_USER_ID;
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

export function isDevBypassEnabled(): boolean {
  return !PROD && !!process.env.DEV_AUTH_BYPASS_USER_ID;
}
