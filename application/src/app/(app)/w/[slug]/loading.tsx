/**
 * Workspace dashboard skeleton — mirrors the real /w/[slug] layout:
 * hero block, 4 stat cards, and a zigzag of 4 section skeletons.
 * Rendered automatically by Next.js while the RSC fetches.
 */
import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardLoading() {
  return (
    <div
      className="mx-auto max-w-5xl px-4 py-10 md:py-16 space-y-10"
      style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between text-xs">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-32" />
      </div>

      {/* Stat cards (4) */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-3xl mx-auto">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="surface p-4 space-y-3">
            <Skeleton variant="circle" className="size-5" />
            <Skeleton className="h-7 w-20" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </section>

      {/* Hero card */}
      <section className="surface p-8 md:p-10 text-center space-y-4">
        <Skeleton className="h-4 w-32 mx-auto" />
        <Skeleton className="h-10 w-3/4 mx-auto" />
        <Skeleton className="h-4 w-1/2 mx-auto" />
      </section>

      {/* 4 zigzag section skeletons */}
      <section className="space-y-12">
        {Array.from({ length: 4 }).map((_, i) => {
          const right = i % 2 === 1;
          return (
            <div key={i} className="flex flex-col items-center gap-4">
              <Skeleton className="h-3 w-16" />
              <Skeleton variant="pill" className="h-12 w-64 max-w-[90%]" />
              <div
                className={`w-full max-w-[560px] flex flex-col gap-5 ${
                  right ? 'items-end' : 'items-start'
                }`}
              >
                {Array.from({ length: 3 }).map((__, j) => (
                  <div
                    key={j}
                    className={`flex items-center gap-3 ${
                      right ? 'flex-row-reverse text-right' : ''
                    }`}
                  >
                    <Skeleton variant="circle" className="size-16 shrink-0" />
                    <div className="space-y-2 w-48">
                      <Skeleton className="h-3 w-3/4" />
                      <Skeleton className="h-2 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
