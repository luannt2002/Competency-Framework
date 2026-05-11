/**
 * Workspace dashboard skeleton — 4 stat card placeholders + radar placeholder.
 * Rendered automatically by Next.js while the RSC at /w/[slug]/page.tsx fetches.
 */
import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-6xl p-6 md:p-8 space-y-6">
      {/* Header row */}
      <header className="flex items-center gap-4">
        <Skeleton variant="circle" className="size-12" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-3 w-32" />
        </div>
      </header>

      {/* Stat cards (4) */}
      <section className="grid gap-3 grid-cols-2 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="surface p-4 space-y-3">
            <Skeleton className="size-5" />
            <Skeleton className="h-7 w-20" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </section>

      {/* Two-column main: radar + side panel */}
      <section className="grid gap-4 md:grid-cols-3">
        <div className="surface p-6 md:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-24" />
          </div>
          {/* Radar placeholder — circle */}
          <div className="flex items-center justify-center py-6">
            <Skeleton variant="circle" className="size-64 md:size-80" />
          </div>
        </div>

        <div className="surface p-6 space-y-4">
          <Skeleton className="h-5 w-32" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton variant="circle" className="size-8" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-2 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
