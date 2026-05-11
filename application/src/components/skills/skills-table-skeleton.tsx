/**
 * Skills table skeleton — mirrors the layout of <SkillsTableClient>:
 *   - Filter bar (search + clear)
 *   - Category & level pill rows
 *   - Result count line
 *   - Table with N rows × 6 cols
 */
import { Skeleton } from '@/components/ui/skeleton';

type Props = {
  /** Number of skeleton rows to render. */
  rows?: number;
};

export function SkillsTableSkeleton({ rows = 8 }: Props) {
  return (
    <>
      {/* Filter bar */}
      <div className="surface p-4 space-y-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-8 w-24" />
        </div>

        {/* Category pills */}
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-4 w-16" />
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} variant="pill" className="h-5 w-20" />
          ))}
        </div>

        {/* Level pills */}
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-4 w-12" />
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} variant="pill" className="h-5 w-10" />
          ))}
        </div>
      </div>

      {/* Result count */}
      <Skeleton className="h-3 w-40" />

      {/* Table */}
      <div className="surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Skill</th>
                <th className="px-4 py-3 text-left">Category</th>
                <th className="px-4 py-3 text-left">Level</th>
                <th className="px-4 py-3 text-left hidden md:table-cell">Target</th>
                <th className="px-4 py-3 text-left hidden md:table-cell">Crowns</th>
                <th className="px-4 py-3 text-left hidden md:table-cell">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {Array.from({ length: rows }).map((_, i) => (
                <tr key={i}>
                  <td className="px-4 py-3">
                    <Skeleton className="h-4 w-40" />
                  </td>
                  <td className="px-4 py-3">
                    <Skeleton variant="pill" className="h-5 w-24" />
                  </td>
                  <td className="px-4 py-3">
                    <Skeleton variant="pill" className="h-5 w-10" />
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <Skeleton variant="pill" className="h-5 w-10" />
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <Skeleton className="h-4 w-12" />
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <Skeleton className="h-3 w-20" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
