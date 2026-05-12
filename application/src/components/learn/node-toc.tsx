'use client';

/**
 * NodeToc — sticky right-rail table of contents for node detail pages.
 *
 * Headings are parsed server-side (see `parseHeadings()` below) and passed
 * in as `headings`, so the client never re-runs the regex on hydration —
 * we just attach an IntersectionObserver to highlight the currently
 * visible heading in the body.
 *
 * The TOC is hidden on mobile (md:) and only renders if the body has 3+
 * headings, mirroring the convention used by many documentation sites.
 */
import * as React from 'react';
import { cn } from '@/lib/utils';
import type { TocHeading } from '@/lib/learn/parse-headings';

export type { TocHeading };

export function NodeToc({ headings }: { headings: TocHeading[] }) {
  const [activeSlug, setActiveSlug] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (headings.length === 0) return;
    if (typeof IntersectionObserver === 'undefined') return;

    const elements = headings
      .map((h) => document.getElementById(h.slug))
      .filter((el): el is HTMLElement => el !== null);

    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Pick the topmost intersecting heading.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) {
          setActiveSlug(visible[0].target.id);
        }
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0 },
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [headings]);

  if (headings.length < 3) return null;

  return (
    <aside className="hidden md:block">
      <nav
        aria-label="Table of contents"
        className="sticky top-20 text-sm space-y-1"
      >
        <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">
          Mục lục
        </div>
        <ul className="space-y-1 border-l border-border">
          {headings.map((h) => (
            <li key={h.slug}>
              <a
                href={`#${h.slug}`}
                className={cn(
                  'block py-1 -ml-px border-l-2 transition-colors',
                  h.level === 3 ? 'pl-6' : 'pl-3',
                  activeSlug === h.slug
                    ? 'border-cyan-500 text-foreground font-medium'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border',
                )}
              >
                {h.text}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
