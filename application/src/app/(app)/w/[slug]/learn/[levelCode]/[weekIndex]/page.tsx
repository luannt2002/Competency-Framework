/**
 * Week Detail page — list modules + lessons for one week.
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eq, and, asc } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import {
  weeks,
  levelTracks,
  modules,
  lessons,
  userLessonProgress,
  lessonSkillMap,
  skills,
} from '@/lib/db/schema';
import { requireWorkspaceAccess } from '@/lib/workspace';
import { requireUser } from '@/lib/auth/supabase-server';
import { LevelBadge } from '@/components/skills/level-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, Clock, Target, BookOpen, CheckCircle2, PlayCircle } from 'lucide-react';
import { AiGenerateButton } from '@/components/learn/ai-generate-button';

export default async function WeekDetailPage({
  params,
}: {
  params: Promise<{ slug: string; levelCode: string; weekIndex: string }>;
}) {
  const { slug, levelCode, weekIndex: weekIdxStr } = await params;
  const ws = await requireWorkspaceAccess(slug);
  const user = await requireUser();
  const weekIdx = Number.parseInt(weekIdxStr, 10);
  if (Number.isNaN(weekIdx)) notFound();

  // Resolve week
  const trackRows = await db
    .select()
    .from(levelTracks)
    .where(and(eq(levelTracks.workspaceId, ws.id), eq(levelTracks.levelCode, levelCode)))
    .limit(1);
  const track = trackRows[0];
  if (!track) notFound();

  const weekRows = await db
    .select()
    .from(weeks)
    .where(
      and(
        eq(weeks.workspaceId, ws.id),
        eq(weeks.trackId, track.id),
        eq(weeks.weekIndex, weekIdx),
      ),
    )
    .limit(1);
  const week = weekRows[0];
  if (!week) notFound();

  // Modules + lessons + user progress
  const moduleRows = await db
    .select()
    .from(modules)
    .where(eq(modules.weekId, week.id))
    .orderBy(asc(modules.displayOrder));

  const lessonRows = moduleRows.length
    ? await db
        .select({
          id: lessons.id,
          slug: lessons.slug,
          moduleId: lessons.moduleId,
          title: lessons.title,
          estMinutes: lessons.estMinutes,
          displayOrder: lessons.displayOrder,
          status: userLessonProgress.status,
        })
        .from(lessons)
        .leftJoin(
          userLessonProgress,
          and(
            eq(userLessonProgress.lessonId, lessons.id),
            eq(userLessonProgress.userId, user.id),
          ),
        )
        .where(eq(lessons.workspaceId, ws.id))
        .orderBy(asc(lessons.displayOrder))
    : [];
  const lessonsByModule = new Map<string, typeof lessonRows>();
  for (const l of lessonRows) {
    if (!lessonsByModule.has(l.moduleId)) lessonsByModule.set(l.moduleId, []);
    lessonsByModule.get(l.moduleId)!.push(l);
  }

  // Skills advanced (sidebar)
  const skillLinks = lessonRows.length
    ? await db
        .select({
          skillName: skills.name,
          contributesToLevel: lessonSkillMap.contributesToLevel,
        })
        .from(lessonSkillMap)
        .innerJoin(skills, eq(skills.id, lessonSkillMap.skillId))
        .where(eq(skills.workspaceId, ws.id))
    : [];
  const uniqueSkills = Array.from(
    new Map(skillLinks.map((s) => [s.skillName, s])).values(),
  );

  const totalLessons = lessonRows.length;
  const completedLessons = lessonRows.filter((l) => l.status === 'completed' || l.status === 'mastered').length;
  const pct = totalLessons === 0 ? 0 : Math.round((completedLessons / totalLessons) * 100);

  return (
    <div className="mx-auto max-w-5xl p-6 md:p-8 space-y-6">
      <Link
        href={`/w/${slug}/learn`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to map
      </Link>

      <header className="space-y-3">
        <div className="flex items-center gap-2">
          <LevelBadge code={levelCode} showLabel />
          <Badge variant="outline">Week {week.weekIndex}</Badge>
          {pct === 100 && (
            <Badge variant="success">
              <CheckCircle2 className="size-3" />
              Completed
            </Badge>
          )}
        </div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{week.title}</h1>
        {week.summary && <p className="text-muted-foreground">{week.summary}</p>}

        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground pt-2">
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3" />
            ~{week.estHours ?? 8}h
          </span>
          <span className="inline-flex items-center gap-1">
            <BookOpen className="size-3" />
            {totalLessons} lessons
          </span>
          <span className="inline-flex items-center gap-1">
            <Target className="size-3" />
            {pct}% complete
          </span>
        </div>

        {week.goals && week.goals.length > 0 && (
          <div className="surface p-4 space-y-1">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              Goals
            </h3>
            <ul className="space-y-1 text-sm">
              {week.goals.map((g, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-1.5 size-1 rounded-full bg-cyan-400 shrink-0" />
                  <span>{g}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </header>

      <div className="grid gap-6 md:grid-cols-[1fr_240px]">
        {/* Modules */}
        <div className="space-y-4">
          {moduleRows.length === 0 && (
            <div className="surface p-8 text-center text-sm text-muted-foreground">
              No modules yet for this week. (Level XS Week 1 is fully seeded; other weeks are stubs — expand the seed JSON to add content.)
            </div>
          )}
          {moduleRows.map((mod) => {
            const lessonsForMod = lessonsByModule.get(mod.id) ?? [];
            return (
              <section key={mod.id} className="surface overflow-hidden">
                <header className="p-4 border-b border-border bg-secondary/20">
                  <h3 className="font-semibold">{mod.title}</h3>
                  {mod.summary && (
                    <p className="text-xs text-muted-foreground mt-1">{mod.summary}</p>
                  )}
                </header>
                <ul className="divide-y divide-border">
                  {lessonsForMod.map((l) => {
                    const status =
                      l.status === 'mastered' ? 'mastered'
                      : l.status === 'completed' ? 'completed'
                      : l.status === 'in_progress' ? 'in-progress'
                      : 'todo';
                    const cta =
                      status === 'completed' || status === 'mastered' ? 'Review'
                      : status === 'in-progress' ? 'Continue'
                      : 'Start';
                    return (
                      <li key={l.id} className="flex items-center gap-3 p-4 hover:bg-secondary/20 transition-colors">
                        <StatusIcon status={status} />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{l.title}</p>
                          <p className="text-xs text-muted-foreground">~{l.estMinutes ?? 8}m</p>
                        </div>
                        <Button asChild size="sm" variant={status === 'todo' ? 'default' : 'outline'}>
                          <Link
                            href={`/w/${slug}/learn/${levelCode}/${week.weekIndex}/${l.slug}`}
                          >
                            {cta} <ArrowRight className="size-3" />
                          </Link>
                        </Button>
                      </li>
                    );
                  })}
                  {lessonsForMod.length === 0 && (
                    <li className="p-4 text-xs text-muted-foreground">No lessons.</li>
                  )}
                </ul>
              </section>
            );
          })}

          {/* AI Generate Content — placeholder for now; wires to first lesson if exists */}
          {lessonRows[0] && (
            <div className="surface p-4 flex items-center gap-3 border-dashed border-violet-500/30 bg-violet-500/5">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Want more exercises?</p>
                <p className="text-xs text-muted-foreground">
                  Use AI to generate additional practice problems for the first lesson.
                </p>
              </div>
              <AiGenerateButton workspaceSlug={slug} lessonId={lessonRows[0].id} count={2} />
            </div>
          )}
        </div>

        {/* Sidebar — skills advanced */}
        <aside className="space-y-2 md:sticky md:top-20 md:self-start">
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
            Skills you'll advance
          </h3>
          <div className="space-y-1.5">
            {uniqueSkills.length === 0 && (
              <p className="text-xs text-muted-foreground">No mapped skills yet.</p>
            )}
            {uniqueSkills.map((s) => (
              <div
                key={s.skillName}
                className="rounded-lg border border-border bg-secondary/30 px-3 py-2 text-xs flex items-center gap-2"
              >
                <span className="flex-1 truncate">{s.skillName}</span>
                <LevelBadge code={s.contributesToLevel} size="sm" />
              </div>
            ))}
          </div>

          {week.keywords && week.keywords.length > 0 && (
            <div className="pt-4">
              <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                Keywords
              </h3>
              <div className="flex flex-wrap gap-1">
                {week.keywords.map((k) => (
                  <span
                    key={k}
                    className="text-[10px] rounded bg-secondary px-1.5 py-0.5 text-muted-foreground"
                  >
                    {k}
                  </span>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: 'todo' | 'in-progress' | 'completed' | 'mastered' }) {
  if (status === 'mastered') return <CheckCircle2 className="size-5 text-violet-400" />;
  if (status === 'completed') return <CheckCircle2 className="size-5 text-emerald-400" />;
  if (status === 'in-progress') return <PlayCircle className="size-5 text-cyan-400" />;
  return <PlayCircle className="size-5 text-muted-foreground" />;
}
