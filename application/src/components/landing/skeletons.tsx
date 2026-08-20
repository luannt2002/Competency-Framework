/**
 * Streaming fallbacks for the three DB-backed landing blocks.
 *
 * Each skeleton mirrors the exact box model of the block it replaces (same
 * grid, same card height, same gaps) so the page does not jump when the
 * server finishes the query — the whole point of putting these behind
 * <Suspense> rather than blocking the hero on Postgres.
 */
import { Skeleton } from '@/components/ui/skeleton';
import { GRID_GAP } from './kit';

export function StatsStripSkeleton() {
  return (
    <div
      className={`mx-auto grid max-w-3xl grid-cols-2 lg:grid-cols-4 ${GRID_GAP}`}
      aria-busy="true"
      aria-label="Đang tải số liệu"
    >
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="surface flex items-center gap-3 px-3 py-3 sm:px-4">
          <Skeleton variant="rounded" className="size-8 shrink-0" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-2.5 w-full max-w-[5.5rem]" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ShowcaseSkeleton() {
  return (
    <div
      className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 ${GRID_GAP}`}
      aria-busy="true"
      aria-label="Đang tải roadmap công khai"
    >
      {[0, 1, 2].map((i) => (
        <div key={i} className="surface flex h-full flex-col p-5 sm:p-6">
          <Skeleton variant="rounded" className="mb-4 size-11" />
          <Skeleton className="mb-2 h-5 w-3/4" />
          <Skeleton className="h-3.5 w-1/2" />
          <Skeleton className="mt-6 h-9 w-full" variant="rounded" />
        </div>
      ))}
    </div>
  );
}

export function BadgeWallSkeleton() {
  return (
    <div
      className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 ${GRID_GAP}`}
      aria-busy="true"
      aria-label="Đang tải huy hiệu"
    >
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="surface flex items-center gap-3 p-4">
          <Skeleton variant="circle" className="size-10 shrink-0" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-3 w-full max-w-[10rem]" />
          </div>
        </div>
      ))}
    </div>
  );
}
