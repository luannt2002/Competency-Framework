/**
 * Skills Matrix page (skeleton).
 * MVP M0: lists skills with category + level badge in a simple table.
 * M1 (Step 6) will add filter/search/sort/bulk edit + drawer.
 */
import { eq, and, asc } from 'drizzle-orm';
import Link from 'next/link';
import { db } from '@/lib/db/client';
import { skills, skillCategories, userSkillProgress } from '@/lib/db/schema';
import { requireWorkspaceAccess } from '@/lib/workspace';
import { requireUser } from '@/lib/auth/supabase-server';
import { Badge } from '@/components/ui/badge';
import { LevelBadge } from '@/components/skills/level-badge';
import { Grid3x3 } from 'lucide-react';

export default async function SkillsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ws = await requireWorkspaceAccess(slug);
  const user = await requireUser();

  // Skills joined with category + user's current level (if any)
  const rows = await db
    .select({
      skillId: skills.id,
      skillName: skills.name,
      skillSlug: skills.slug,
      tags: skills.tags,
      categoryId: skillCategories.id,
      categoryName: skillCategories.name,
      categoryColor: skillCategories.color,
      levelCode: userSkillProgress.levelCode,
      crowns: userSkillProgress.crowns,
      updatedAt: userSkillProgress.updatedAt,
    })
    .from(skills)
    .innerJoin(skillCategories, eq(skills.categoryId, skillCategories.id))
    .leftJoin(
      userSkillProgress,
      and(
        eq(userSkillProgress.skillId, skills.id),
        eq(userSkillProgress.userId, user.id),
        eq(userSkillProgress.workspaceId, ws.id),
      ),
    )
    .where(eq(skills.workspaceId, ws.id))
    .orderBy(asc(skillCategories.displayOrder), asc(skills.displayOrder), asc(skills.name));

  return (
    <div className="mx-auto max-w-7xl p-6 md:p-8 space-y-6">
      <header className="flex items-center gap-3">
        <Grid3x3 className="size-6 text-cyan-400" />
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Skills Matrix</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {rows.length} skills across {ws.name}
          </p>
        </div>
      </header>

      {/* Empty state */}
      {rows.length === 0 && (
        <div className="surface p-12 text-center">
          <p className="text-muted-foreground">
            No skills yet. Re-fork the framework template or run{' '}
            <code className="text-foreground">pnpm db:seed</code>.
          </p>
        </div>
      )}

      {/* Table */}
      {rows.length > 0 && (
        <div className="surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Skill</th>
                  <th className="px-4 py-3 text-left">Category</th>
                  <th className="px-4 py-3 text-left">Level</th>
                  <th className="px-4 py-3 text-left">Crowns</th>
                  <th className="px-4 py-3 text-left">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => (
                  <tr
                    key={r.skillId}
                    className="transition-colors hover:bg-secondary/30 cursor-pointer"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium">{r.skillName}</div>
                      {r.tags && r.tags.length > 0 && (
                        <div className="mt-0.5 flex flex-wrap gap-1">
                          {r.tags.slice(0, 3).map((t) => (
                            <span
                              key={t}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant="outline"
                        style={{
                          borderColor: `${r.categoryColor ?? '#475569'}40`,
                          color: r.categoryColor ?? undefined,
                        }}
                      >
                        {r.categoryName}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <LevelBadge code={r.levelCode} />
                    </td>
                    <td className="px-4 py-3 text-amber-400 tabular-nums">
                      {r.crowns ?? 0}<span className="text-muted-foreground">/5</span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {r.updatedAt ? new Date(r.updatedAt).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="text-xs text-muted-foreground">
        ⚙️ M1 will add: filter (Category, Level), search, sort, inline level edit, bulk edit, side drawer for self-assessment.{' '}
        <Link href={`/w/${slug}`} className="underline">Back to dashboard</Link>
      </div>
    </div>
  );
}
