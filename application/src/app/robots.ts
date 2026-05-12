/**
 * robots.txt — emitted at `/robots.txt`.
 *
 * Public-facing routes (`/`, `/discover`, `/share/`, `/u/`, `/sign-in`) are
 * allowed; auth'd workspace routes, API endpoints, and personal pages are
 * disallowed so crawlers don't waste budget on private content they can't
 * see anyway. The sitemap URL is referenced absolute so crawlers can find
 * it directly.
 */
import type { MetadataRoute } from 'next';

const BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, '') ?? 'http://localhost:3000';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/discover', '/share/', '/u/', '/sign-in'],
        disallow: [
          '/w/',
          '/api/',
          '/auth/',
          '/profile',
          '/settings',
          '/onboarding',
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
