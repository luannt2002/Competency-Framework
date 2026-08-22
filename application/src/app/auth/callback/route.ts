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

/**
 * Chỉ nhận đường dẫn nội bộ làm đích chuyển hướng sau đăng nhập.
 *
 * GIA CỐ, không phải vá lỗ hổng — đã đo: với `${origin}${next}` và `origin`
 * không có dấu `/` cuối, mọi payload thử qua (`//evil.com`, `///evil.com`,
 * `/\evil.com`, `https://evil.com`) đều cho ra host của chính mình, không cái
 * nào thoát ra ngoài. Vậy hiện KHÔNG có open redirect.
 *
 * Nhưng an toàn ấy đang dựa vào một bất biến NGẦM: đích được ghép bằng nối
 * chuỗi sau một origin không có dấu gạch cuối. Ai đổi sang `new URL(next,
 * origin)` — một refactor trông vô hại — là `//evil.com` thoát ra ngay. Viết
 * hẳn ràng buộc ra đây để nó không phụ thuộc vào cách ghép chuỗi nữa.
 */
function safeNextPath(raw: string | null): string {
  const fallback = '/onboarding';
  if (!raw) return fallback;
  // Phải là đường dẫn tuyệt đối nội bộ: đúng một `/` mở đầu, không `//`, không
  // `\` (trình duyệt quy `\` về `/`), không scheme.
  if (!raw.startsWith('/')) return fallback;
  if (raw.startsWith('//') || raw.startsWith('/\\')) return fallback;
  if (raw.includes('\\')) return fallback;
  return raw;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = safeNextPath(searchParams.get('next'));

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
