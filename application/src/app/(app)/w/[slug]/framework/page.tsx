/**
 * Framework Editor placeholder.
 * M2 (Step 8) will implement full CRUD + Import tab.
 */
import { eq, asc, count } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { skillCategories, skills, competencyLevels } from '@/lib/db/schema';
import { requireWorkspaceAccess } from '@/lib/workspace';
import { Boxes } from 'lucide-react';
import { LevelBadge } from '@/components/skills/level-badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default async function FrameworkPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ws = await requireWorkspaceAccess(slug);

  const cats = await db
    .select({
      id: skillCategories.id,
      name: skillCategories.name,
      color: skillCategories.color,
    })
    .from(skillCategories)
    .where(eq(skillCategories.workspaceId, ws.id))
    .orderBy(asc(skillCategories.displayOrder));

  const skillTotals = await db
    .select({ catId: skills.categoryId, n: count() })
    .from(skills)
    .where(eq(skills.workspaceId, ws.id))
    .groupBy(skills.categoryId);

  const skillByCat = new Map(skillTotals.map((r) => [r.catId, r.n]));

  const levels = await db
    .select()
    .from(competencyLevels)
    .where(eq(competencyLevels.workspaceId, ws.id))
    .orderBy(asc(competencyLevels.displayOrder), asc(competencyLevels.numericValue));

  return (
    <div className="mx-auto max-w-5xl p-6 md:p-8 space-y-6">
      <header className="flex items-center gap-3">
        <Boxes className="size-7 text-violet-400" />
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Framework Editor</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Customize categories, skills, levels for {ws.name}
          </p>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Categories ({cats.length})</CardTitle>
            <CardDescription>Skill groupings (e.g., AWS, Terraform, K8s)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {cats.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 px-3 py-2"
              >
                <span className="flex items-center gap-2 text-sm">
                  <span
                    className="size-2 rounded-full"
                    style={{ backgroundColor: c.color ?? '#94A3B8' }}
                  />
                  {c.name}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {skillByCat.get(c.id) ?? 0} skills
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Competency Levels</CardTitle>
            <CardDescription>How proficiency is measured</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {levels.map((l) => (
              <div key={l.id} className="space-y-1">
                <div className="flex items-center justify-between">
                  <LevelBadge code={l.code} showLabel size="md" />
                  <span className="text-xs font-mono text-muted-foreground">
                    {l.numericValue}
                  </span>
                </div>
                {l.description && (
                  <p className="text-xs text-muted-foreground leading-snug">{l.description}</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Import from Google Sheets</CardTitle>
          <CardDescription>
            Paste CSV exports from Google Sheets (Sheet 1 gid 1970847068 = Skills, Sheet 2 gid 1890838692 = Levels). Coming in M2.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            For now, export CSVs and place in <code>drizzle/seeds/raw-csv/</code> then run{' '}
            <code className="text-foreground">pnpm gen:seed-from-csv && pnpm db:seed</code>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
