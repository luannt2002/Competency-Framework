/**
 * Node detail skeleton — matches /w/[slug]/n/[nodeSlug] page layout:
 * breadcrumb, header card with title + meta, body content card and a
 * children grid below.
 */
import { Skeleton } from '@/components/ui/skeleton';

export default function NodeDetailLoading() {
  return (
    <div
      className="mx-auto max-w-4xl px-4 py-8 md:py-12 space-y-8"
      style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
    >
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-3" />
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-3" />
        <Skeleton className="h-3 w-32" />
      </div>

      {/* Header card */}
      <section className="surface p-6 md:p-8 space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton variant="circle" className="size-10" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-9 w-3/4" />
        <Skeleton className="h-4 w-2/3" />
        <div className="flex flex-wrap gap-2 pt-2">
          <Skeleton variant="pill" className="h-6 w-20" />
          <Skeleton variant="pill" className="h-6 w-16" />
          <Skeleton variant="pill" className="h-6 w-24" />
        </div>
      </section>

      {/* Body content card */}
      <section className="surface p-6 md:p-8 space-y-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-[95%]" />
        <Skeleton className="h-3 w-[88%]" />
        <Skeleton className="h-3 w-[92%]" />
        <Skeleton className="h-3 w-3/4" />
      </section>

      {/* Children grid */}
      <section className="space-y-4">
        <Skeleton className="h-5 w-32" />
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="surface p-4 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
