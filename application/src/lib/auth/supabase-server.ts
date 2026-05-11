/**
 * Supabase server-side client (SSR-friendly, uses cookies from next/headers).
 * Use this in Server Components and Server Actions to read session.
 *
 * Dev-only: if DEV_AUTH_BYPASS_USER_ID is set AND NODE_ENV !== 'production',
 * getCurrentUser() returns a synthesized user pointing to a real DB user_id.
 * See `./dev-bypass.ts`.
 */
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getDevBypassUser } from './dev-bypass';

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // ignore in RSC where cookies are read-only
          }
        },
      },
    },
  );
}

/** Returns the current session user or null. */
export async function getCurrentUser() {
  // Dev bypass — guarded by NODE_ENV check inside getDevBypassUser
  const bypass = getDevBypassUser();
  if (bypass) return bypass;

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

/** Throws if not signed in. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error('UNAUTHORIZED');
  return user;
}
