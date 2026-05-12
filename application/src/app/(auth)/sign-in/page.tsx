/**
 * Sign-in page — Supabase Auth (magic link + Google OAuth).
 */
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/auth/supabase-client';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Mail, Loader2 } from 'lucide-react';

export default function SignInPage() {
  const searchParams = useSearchParams();
  // Honor `?next=/some/path` so deep-links from /share land back where they came from after auth.
  // Sanitize: must start with '/' and not be a protocol-relative URL.
  const rawNext = searchParams.get('next');
  const nextPath = rawNext && rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : null;
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signInWithMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const redirectUrl = nextPath
      ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`
      : `${window.location.origin}/auth/callback`;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectUrl,
      },
    });
    setLoading(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  async function signInWithGoogle() {
    setLoading(true);
    const redirectUrl = nextPath
      ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`
      : `${window.location.origin}/auth/callback`;
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirectUrl },
    });
  }

  return (
    <main
      className="min-h-dvh flex items-center justify-center p-6 bg-background"
      style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
    >
      <div className="w-full max-w-sm">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          Back
        </Link>

        <div className="surface p-8 shadow-sm">
          <div className="size-12 rounded-2xl accent-gradient flex items-center justify-center mb-5 shadow-lg shadow-cyan-500/20">
            <Mail className="size-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Sign in to continue your competency journey.
          </p>

          {sent ? (
            <div className="mt-6 rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-sm">
              <p className="font-semibold text-emerald-700">Check your email</p>
              <p className="mt-1 text-emerald-700/80">
                We sent a magic link to{' '}
                <span className="text-foreground font-medium">{email}</span>.
              </p>
            </div>
          ) : (
            <form onSubmit={signInWithMagicLink} className="mt-6 space-y-3">
              <div>
                <label
                  htmlFor="email"
                  className="block text-xs font-semibold mb-1.5 text-foreground/80"
                >
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary/40 transition-colors"
                  placeholder="you@example.com"
                />
              </div>
              {error && <p className="text-xs text-destructive">{error}</p>}
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
                Send magic link
              </Button>
            </form>
          )}

          <div className="my-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground uppercase tracking-wider">or</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <Button variant="outline" className="w-full" onClick={signInWithGoogle} disabled={loading}>
            Continue with Google
          </Button>
        </div>

        <p className="mt-6 text-xs text-muted-foreground text-center">
          New here? Just sign in — we&apos;ll create your account automatically.
        </p>

        {/* Dev bypass hint — visible when DEV_AUTH_BYPASS_USER_ID set */}
        {process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_DEV_BYPASS_HINT === '1' && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs">
            <p className="font-semibold text-amber-700">Dev bypass active</p>
            <p className="mt-1 text-amber-700/80">
              Auth shortcut enabled. Go directly to{' '}
              <Link href="/w/devops-test" className="underline font-medium text-amber-800 hover:text-amber-900">
                /w/devops-test
              </Link>
              .
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
