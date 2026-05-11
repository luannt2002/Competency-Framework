/**
 * Course Map loading state — 4 level section bars + 12 week node placeholders.
 * Rendered automatically by Next.js during RSC fetch of /w/[slug]/learn/page.tsx.
 */
import { Skeleton } from '@/components/ui/skeleton';

export default function LearnLoading() {
  // 4 sections, 3 nodes each = 12 nodes total.
  const sections = Array.from({ length: 4 });
  const nodesPerSection = 3;

  return (
    <div className="mx-auto max-w-4xl p-6 md:p-8 space-y-10">
      {/* Header */}
      <header className="flex items-center gap-3">
        <Skeleton className="size-7" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-44" />
          <Skeleton className="h-3 w-64" />
        </div>
      </header>

      {sections.map((_, si) => (
        <section key={si} className="space-y-6">
          {/* Section header bar */}
          <div className="surface p-4 flex items-center gap-3">
            <Skeleton variant="rounded" className="size-10" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-4 w-16" />
          </div>

          {/* Node column — alternating offsets to mimic the snake path */}
          <div className="relative mx-auto" style={{ width: 360, height: nodesPerSection * 110 + 60 }}>
            {Array.from({ length: nodesPerSection }).map((__, ni) => {
              const offset = Math.sin(ni * 0.9) * 80;
              const left = 360 / 2 + offset - 30;
              const top = 40 + ni * 110 - 30;
              return (
                <div key={ni}>
                  <Skeleton
                    variant="circle"
                    className="absolute size-[60px]"
                    style={{ left, top }}
                  />
                  <div
                    className="absolute space-y-1 text-center"
                    style={{ left: left - 40, top: top + 60 + 4, width: 140 }}
                  >
                    <Skeleton className="h-2 w-12 mx-auto" />
                    <Skeleton className="h-3 w-24 mx-auto" />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
