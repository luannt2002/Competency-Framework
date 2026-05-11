/**
 * Daily Planner loading state — header skeleton + goal bar + 3 task placeholders.
 * Rendered automatically by Next.js during RSC fetch of /w/[slug]/daily/page.tsx.
 */
import { Skeleton } from '@/components/ui/skeleton';

export default function DailyLoading() {
  return (
    <div className="mx-auto max-w-3xl p-6 md:p-8 space-y-6">
      {/* Header */}
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Skeleton className="size-7" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-24" />
            <Skeleton className="h-3 w-56" />
          </div>
        </div>
        <Skeleton className="h-8 w-24" />
      </header>

      {/* Goal bar */}
      <section className="surface p-4 space-y-2">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
        </div>
        <Skeleton variant="pill" className="h-2 w-full" />
      </section>

      {/* 3 task placeholders */}
      <section className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="surface p-4 flex items-center gap-4">
            <Skeleton variant="circle" className="size-10 shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-8 w-20" />
          </div>
        ))}
      </section>
    </div>
  );
}
