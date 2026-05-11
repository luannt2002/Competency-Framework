/**
 * Global 404 — full-screen, inline SVG line-art (no Lottie / no external assets).
 */
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-dvh flex items-center justify-center p-6 bg-background text-foreground">
      <div className="w-full max-w-md text-center space-y-6">
        {/* Inline SVG line-art — a stylised compass / missing-square motif */}
        <div className="mx-auto w-48 h-48">
          <svg
            viewBox="0 0 200 200"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full h-full"
            role="img"
            aria-label="Page not found illustration"
          >
            <defs>
              <linearGradient id="notFoundGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#22D3EE" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.9" />
              </linearGradient>
            </defs>

            {/* Outer rounded square */}
            <rect
              x="20"
              y="20"
              width="160"
              height="160"
              rx="20"
              stroke="url(#notFoundGrad)"
              strokeWidth="2"
              strokeDasharray="6 6"
              fill="none"
            />

            {/* Inner missing square (placeholder) */}
            <rect
              x="60"
              y="60"
              width="80"
              height="80"
              rx="10"
              stroke="currentColor"
              strokeOpacity="0.4"
              strokeWidth="2"
              fill="none"
            />

            {/* Diagonal "missing" cross */}
            <line
              x1="60"
              y1="60"
              x2="140"
              y2="140"
              stroke="currentColor"
              strokeOpacity="0.25"
              strokeWidth="2"
            />
            <line
              x1="140"
              y1="60"
              x2="60"
              y2="140"
              stroke="currentColor"
              strokeOpacity="0.25"
              strokeWidth="2"
            />

            {/* 404 text */}
            <text
              x="100"
              y="108"
              textAnchor="middle"
              fill="url(#notFoundGrad)"
              fontSize="24"
              fontWeight="700"
              fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
            >
              404
            </text>
          </svg>
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Page not found</h1>
          <p className="text-sm text-muted-foreground">
            We couldn&apos;t find what you were looking for. The link may be broken
            or the page may have moved.
          </p>
        </div>

        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/">
              <ArrowLeft className="size-4" />
              Go back home
            </Link>
          </Button>
          <Button asChild>
            <Link href="/profile">
              <Home className="size-4" />
              My profile
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
