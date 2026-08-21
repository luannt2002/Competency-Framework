import type { NextConfig } from 'next';

/**
 * Security headers — baseline hardening (OWASP).
 * CSP allows: self, Supabase auth, inline styles (Tailwind/framer inject),
 * and framing ONLY from localhost so the dev pane still works in development.
 */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // Next.js dev needs eval + ws; production stays stricter
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co ws: wss:",
      "frame-ancestors 'self' http://localhost:*",
      "object-src 'none'",
      "base-uri 'self'",
    ].join('; '),
  },
];

/**
 * Audit 6.1 — "strip HTML comments in production HTML": investigated, nothing
 * to strip. The only `<!-- -->` blocks in rendered pages (/, /discover, /login
 * checked via curl) are React hydration markers:
 *   <!--$--> / <!--/$--> / <!--$?-->  — Suspense boundary markers
 *   <!-- -->                          — adjacent-text separators React inserts
 * These are required by the React reconciler and must NOT be removed (App
 * Router has no supported HTML post-processing hook anyway). JSX comments in
 * source are compile-time only — they never reach the DOM. No dev notes leak
 * into production HTML; no transform added.
 */
const nextConfig: NextConfig = {
  // Lets a production build live beside a running dev server instead of
  // overwriting its `.next`. Needed to benchmark prod honestly:
  //   NEXT_DIST_DIR=.next-prod pnpm build
  //   NEXT_DIST_DIR=.next-prod PORT=3001 pnpm start
  // Unset in normal use, so dev and CI keep the default `.next`.
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '5mb', // for CSV import
    },
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
    ],
  },
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
};

export default nextConfig;
