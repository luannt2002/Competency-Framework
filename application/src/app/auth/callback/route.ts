/**
 * Supabase OAuth/magic-link callback.
 * Exchanges the auth code in the URL for a session.
 *
 * Sau khi session thành công: auto-join mọi workspace đã mời email này khi
 * còn pending (D2.5) — acceptPendingInvites là idempotent + non-throwing,
 * lỗi phần này không bao giờ chặn redirect.
 */
import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/auth/supabase-server';
import { acceptPendingInvites } from '@/lib/auth/join-pending-invites';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/onboarding';

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Auto-join pending invites (D2.5). Email có thể đổi case — helper
      // normalize. Không throw; fail thì để lần đăng nhập sau thử lại.
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email) await acceptPendingInvites(user.id, user.email);
      } catch (err) {
        console.error('[auth callback] acceptPendingInvites failed:', err);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/sign-in?error=auth_failed`);
}
