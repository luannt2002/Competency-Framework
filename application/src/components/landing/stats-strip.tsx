/**
 * Hero stats strip — four counters read live from Postgres.
 *
 * Async server component; the page renders it inside <Suspense> so the hero
 * copy paints immediately and the numbers stream in behind a skeleton of the
 * same shape. Three states are covered: data, "nothing published yet", and
 * "the query failed".
 */
import Link from 'next/link';
import { AlertTriangle, GitBranch, Layers, Network, Trophy } from 'lucide-react';
import { getLandingStats } from './landing-data';
import { GRID_GAP, StatTile, formatCount } from './kit';

export async function StatsStrip() {
  const stats = await getLandingStats();

  // Error — the strip is decorative relative to the hero CTA, so it degrades
  // to a single compact line instead of a full-width alert card.
  if (!stats) {
    return (
      <p
        role="alert"
        className="mx-auto flex max-w-md items-center justify-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-2.5 text-xs text-destructive"
      >
        <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
        Không tải được số liệu roadmap. Thử tải lại trang.
      </p>
    );
  }

  // Empty — no workspace has been published yet.
  if (stats.roadmaps === 0) {
    return (
      <p className="mx-auto max-w-md text-center text-xs text-muted-foreground sm:text-sm">
        Chưa có lộ trình công khai nào.{' '}
        <Link href="/sign-in" className="font-medium text-primary underline-offset-4 hover:underline">
          Bạn có thể là người đầu tiên publish
        </Link>
        .
      </p>
    );
  }

  return (
    <dl className={`mx-auto grid max-w-3xl grid-cols-2 lg:grid-cols-4 ${GRID_GAP}`}>
      <StatTile
        icon={Network}
        value={formatCount(stats.roadmaps)}
        label="lộ trình công khai"
      />
      <StatTile
        icon={GitBranch}
        value={formatCount(stats.nodes)}
        label="mục trong cây"
      />
      <StatTile
        icon={Layers}
        value={formatCount(stats.levels)}
        label="cấp sâu nhất"
      />
      <StatTile
        icon={Trophy}
        value={formatCount(stats.badges)}
        label="huy hiệu đã định nghĩa"
      />
    </dl>
  );
}
