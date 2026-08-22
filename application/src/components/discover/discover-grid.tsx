'use client';

/**
 * Client island for the public discover page.
 *
 * Receives the full prebuilt list of public workspaces (server-fetched) and
 * provides:
 *   - A search input that filters by name substring as the user types.
 *   - A domain filter derived from each workspace's root nodeType (there is
 *     no domain column — coarse approximation, see discover/page.tsx).
 *   - A sort control: Mới nhất (createdAt desc, default), Phổ biến nhất
 *     (fork count desc), Nhiều node nhất (node count desc).
 *   - A responsive grid (3 cols desktop, 1 col mobile) of workspace cards.
 *
 * Filtering/sorting happens entirely on the client — counts are small and we
 * already have everything in props from the SSR pass.
 */
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { GitFork, Search } from 'lucide-react';

export type DiscoverWorkspace = {
  id: string;
  name: string;
  slug: string;
  ownerUserId: string | null;
  createdAt: string;
  totalNodes: number;
  totalPhases: number;
  /** Root node's nodeType — used as a coarse "domain" category. */
  rootNodeType: string | null;
  /** Mô tả workspace; lùi về mô tả node gốc với dữ liệu cũ. */
  description: string | null;
  /** Distinct users who forked this workspace (from activity_log). */
  forkCount: number;
};

type SortKey = 'newest' | 'popular' | 'mostNodes';

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'newest', label: 'Mới nhất' },
  { value: 'popular', label: 'Phổ biến nhất' },
  { value: 'mostNodes', label: 'Nhiều node nhất' },
];

/** Human labels for the nodeTypes used as domain categories. */
const DOMAIN_LABELS: Record<string, string> = {
  course: 'Khóa học',
  phase: 'Giai đoạn',
  stage: 'Chặng',
  project: 'Dự án',
  milestone: 'Cột mốc',
  custom: 'Tùy chỉnh',
};

function domainLabel(nodeType: string): string {
  return DOMAIN_LABELS[nodeType] ?? nodeType;
}

export function DiscoverGrid({ workspaces }: { workspaces: DiscoverWorkspace[] }) {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<SortKey>('newest');
  const [domain, setDomain] = useState('all');

  const domains = useMemo(() => {
    const set = new Set<string>();
    for (const w of workspaces) {
      if (w.rootNodeType) set.add(w.rootNodeType);
    }
    return [...set].sort();
  }, [workspaces]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const matched = workspaces.filter((w) => {
      if (needle && !w.name.toLowerCase().includes(needle)) return false;
      if (domain !== 'all' && w.rootNodeType !== domain) return false;
      return true;
    });
    const sorted = [...matched];
    if (sort === 'popular') {
      sorted.sort(
        (a, b) =>
          b.forkCount - a.forkCount ||
          b.createdAt.localeCompare(a.createdAt),
      );
    } else if (sort === 'mostNodes') {
      sorted.sort(
        (a, b) =>
          b.totalNodes - a.totalNodes ||
          b.createdAt.localeCompare(a.createdAt),
      );
    } else {
      sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
    return sorted;
  }, [q, domain, sort, workspaces]);

  return (
    <>
      <div className="max-w-2xl mx-auto mb-8 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
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
        <select
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          aria-label="Lọc theo loại lộ trình"
          className="h-11 rounded-xl border border-border bg-card px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
        >
          <option value="all">Mọi loại</option>
          {domains.map((d) => (
            <option key={d} value={d}>
              {domainLabel(d)}
            </option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          aria-label="Sắp xếp lộ trình"
          className="h-11 rounded-xl border border-border bg-card px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="surface p-10 text-center max-w-xl mx-auto">
          {workspaces.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Chưa có lộ trình công khai. Bạn có thể tạo và public cái của mình trong Settings.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Không tìm thấy lộ trình nào khớp với bộ lọc hiện tại.
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
                  {w.rootNodeType && (
                    <span className="shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                      {domainLabel(w.rootNodeType)}
                    </span>
                  )}
                </div>
                <code className="self-start text-[11px] font-mono px-2 py-0.5 rounded bg-secondary text-muted-foreground mb-3">
                  {w.slug}
                </code>
                {w.description && (
                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 mb-3">
                    {w.description}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mb-5 flex flex-wrap items-center gap-x-2">
                  <span>
                    <span className="font-mono">{w.totalPhases}</span> giai đoạn{' '}
                    <span className="opacity-60">·</span>{' '}
                    <span className="font-mono">{w.totalNodes}</span> mục
                  </span>
                  <span className="opacity-60">·</span>
                  <span className="inline-flex items-center gap-1">
                    <GitFork className="size-3" aria-hidden />
                    <span className="font-mono">{w.forkCount}</span> fork
                  </span>
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
