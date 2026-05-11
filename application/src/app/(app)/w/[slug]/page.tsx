/**
 * Workspace Dashboard.
 * MVP M0: shows static skeleton with "Today" block + placeholder charts.
 * M5 will wire real data (radar, heat map, progress ring, activity).
 */
import { eq, and, count } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { skills, userSkillProgress, weeks, lessons } from '@/lib/db/schema';
import { requireWorkspaceAccess } from '@/lib/workspace';
import { requireUser } from '@/lib/auth/supabase-server';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LevelBadge } from '@/components/skills/level-badge';
import { ArrowRight, GraduationCap, Grid3x3, Sparkles, Trophy } from 'lucide-react';
import Link from 'next/link';

export default async function DashboardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ws = await requireWorkspaceAccess(slug);
  const user = await requireUser();

  // Aggregate counts (workspace-scoped)
  const [skillCount] = await db
    .select({ n: count() })
    .from(skills)
    .where(eq(skills.workspaceId, ws.id));

  const [progressCount] = await db
    .select({ n: count() })
    .from(userSkillProgress)
    .where(
      and(eq(userSkillProgress.workspaceId, ws.id), eq(userSkillProgress.userId, user.id)),
    );

  const [weekCount] = await db
    .select({ n: count() })
    .from(weeks)
    .where(eq(weeks.workspaceId, ws.id));

  const [lessonCount] = await db
    .select({ n: count() })
    .from(lessons)
    .where(eq(lessons.workspaceId, ws.id));

  const totalSkills = skillCount?.n ?? 0;
  const assessed = progressCount?.n ?? 0;
  const totalWeeks = weekCount?.n ?? 0;
  const totalLessons = lessonCount?.n ?? 0;
  const coverage = totalSkills > 0 ? Math.round((assessed / totalSkills) * 100) : 0;

  return (
    <div className="mx-auto max-w-6xl p-6 md:p-8 space-y-8">
      {/* Hero / Today block */}
      <section>
        <Badge variant="outline" className="mb-3">
          <Sparkles className="size-3 text-cyan-400" />
          Dashboard
        </Badge>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{ws.name}</h1>
        <p className="text-muted-foreground mt-2">
          {assessed} of {totalSkills} skills assessed · {totalLessons} lessons available across{' '}
          {totalWeeks} weeks
        </p>
      </section>

      {/* Today + key stats */}
      <section className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2 overflow-hidden">
          <div className="relative">
            <div className="absolute inset-0 -z-10 accent-gradient opacity-10" />
            <CardHeader>
              <Badge variant="success" className="w-fit">
                <Sparkles className="size-3" />
                Today
              </Badge>
              <CardTitle className="text-2xl mt-2">Continue learning</CardTitle>
              <CardDescription>
                Week 1 · Setup, AWS Foundations, IAM Deep Dive
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Pick up where you left off — 2 lessons remaining in Week 1.
              </p>
              <Button asChild>
                <Link href={`/w/${ws.slug}/learn`}>
                  Open Course Map <ArrowRight className="size-4" />
                </Link>
              </Button>
            </CardContent>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="size-4 text-amber-400" />
              Coverage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold tabular-nums accent-gradient-text">{coverage}%</div>
            <p className="text-xs text-muted-foreground mt-1">of skills assessed</p>
            <div className="mt-3 h-2 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full accent-gradient transition-all duration-700"
                style={{ width: `${coverage}%` }}
              />
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Quick links */}
      <section className="grid gap-4 sm:grid-cols-2">
        <Link href={`/w/${ws.slug}/skills`} className="surface p-6 surface-hover group">
          <Grid3x3 className="size-6 text-cyan-400 mb-3" />
          <h3 className="font-semibold mb-1">Skills Matrix</h3>
          <p className="text-sm text-muted-foreground">
            Review and self-assess across {totalSkills} skills. Filter, sort, bulk edit.
          </p>
        </Link>

        <Link href={`/w/${ws.slug}/learn`} className="surface p-6 surface-hover group">
          <GraduationCap className="size-6 text-violet-400 mb-3" />
          <h3 className="font-semibold mb-1">Course Map</h3>
          <p className="text-sm text-muted-foreground">
            Duolingo-style path of {totalWeeks} weeks. Unlock the next level by completing lessons.
          </p>
        </Link>
      </section>

      {/* Placeholder for charts (M5) */}
      <section className="surface p-6">
        <h3 className="font-semibold mb-2">Coverage by Category</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Radar chart + heat map will render here once you assess your first skills. (M5)
        </p>
        <div className="grid gap-2 sm:grid-cols-4">
          {(['XS', 'S', 'M', 'L'] as const).map((c) => (
            <div key={c} className="rounded-xl border border-border bg-secondary/30 p-4 text-center">
              <LevelBadge code={c} size="lg" />
              <p className="text-xs text-muted-foreground mt-2">0 skills</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
