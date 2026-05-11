/**
 * Skills Matrix loading state — header skeleton + table skeleton (8 rows × 6 cols).
 * Rendered automatically by Next.js during RSC fetch of /w/[slug]/skills/page.tsx.
 */
import { Skeleton } from '@/components/ui/skeleton';
import { SkillsTableSkeleton } from '@/components/skills/skills-table-skeleton';

export default function SkillsLoading() {
  return (
    <div className="mx-auto max-w-7xl p-6 md:p-8 space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:gap-6">
        <div className="flex items-center gap-3">
          <Skeleton className="size-6" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-3 w-56" />
          </div>
        </div>
        <div className="md:ml-auto">
          <Skeleton className="h-9 w-28" />
        </div>
      </header>

      <SkillsTableSkeleton rows={8} />
    </div>
  );
}
