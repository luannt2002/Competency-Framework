'use client';

/**
 * Client island for the public discover page.
 *
 * Receives the full prebuilt list of public workspaces (server-fetched) and
 * provides:
 *   - A search input that filters by name substring as the user types.
 *   - A responsive grid (3 cols desktop, 1 col mobile) of workspace cards.
 *
 * Filtering happens entirely on the client — counts are small and we already
 * have everything in props from the SSR pass.
 */
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';

export type DiscoverWorkspace = {
  id: string;
  name: string;
  slug: string;
  ownerUserId: string | null;
  totalNodes: number;
  totalPhases: number;
};

export function DiscoverGrid({ workspaces }: { workspaces: DiscoverWorkspace[] }) {
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return workspaces;
    return workspaces.filter((w) => w.name.toLowerCase().includes(needle));
  }, [q, workspaces]);

  return (
    <>
      <div className="relative max-w-xl mx-auto mb-8">
        <Search
          className="size-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          aria-hidden
        />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm theo tên lộ trình..."
          aria-label="Tìm theo tên lộ trình"
          className="w-full h-11 rounded-xl border border-border bg-card pl-10 pr-4 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="surface p-10 text-center max-w-xl mx-auto">
          {workspaces.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Chưa có lộ trình công khai. Bạn có thể tạo và public cái của mình trong Settings.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Không tìm thấy lộ trình nào khớp với &quot;{q}&quot;.
            </p>
          )}
        </div>
      ) : (
        <ul
          role="list"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
        >
          {filtered.map((w) => (
            <li key={w.id}>
              <article className="relative overflow-hidden rounded-2xl border border-border bg-card pt-5 px-5 pb-5 surface-lift flex flex-col h-full">
                {/* Coral accent top border */}
                <span
                  aria-hidden
                  className="absolute top-0 left-0 right-0 h-1 bg-primary"
                />
                <div className="flex items-start justify-between gap-3 mb-3">
                  <h3 className="text-base font-semibold leading-tight line-clamp-2">
                    {w.name}
                  </h3>
                </div>
                <code className="self-start text-[11px] font-mono px-2 py-0.5 rounded bg-secondary text-muted-foreground mb-4">
                  {w.slug}
                </code>
                <p className="text-xs text-muted-foreground mb-5">
                  <span className="font-mono">{w.totalPhases}</span> giai đoạn{' '}
                  <span className="mx-1 opacity-60">·</span>{' '}
                  <span className="font-mono">{w.totalNodes}</span> mục
                </p>
                <Link
                  href={`/share/${w.slug}`}
                  className="mt-auto inline-flex items-center justify-center w-full h-9 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
                >
                  Xem roadmap →
                </Link>
              </article>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
