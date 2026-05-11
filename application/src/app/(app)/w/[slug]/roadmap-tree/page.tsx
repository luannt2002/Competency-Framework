/**
 * Roadmap Tree page — recursive hierarchy view:
 *   Tier 1: Career Level (XS/S/M/L) → Tier 2: Weeks → Tier 3: Modules/Lessons/Labs
 * All data from DB, no hardcoded content.
 */
import { eq, asc, and, inArray } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import {
  levelTracks,
  weeks as weeksT,
  modules as modulesT,
  lessons as lessonsT,
  exercises as exercisesT,
  labs as labsT,
  userLevelProgress,
} from '@/lib/db/schema';
import { requireWorkspaceAccess } from '@/lib/workspace';
import { requireUser } from '@/lib/auth/supabase-server';
import { Network } from 'lucide-react';
import { RoadmapTree, type TreeTrack } from '@/components/learn/roadmap-tree';

export default async function RoadmapTreePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ws = await requireWorkspaceAccess(slug);
  const user = await requireUser();

  // Fetch all hierarchy data in parallel
  const [tracks, allWeeks, allModules, allLessons, allExercises, allLabs, userLvls] = await Promise.all([
    db.select().from(levelTracks).where(eq(levelTracks.workspaceId, ws.id)).orderBy(asc(levelTracks.displayOrder)),
    db.select().from(weeksT).where(eq(weeksT.workspaceId, ws.id)).orderBy(asc(weeksT.weekIndex)),
    db.select().from(modulesT).where(eq(modulesT.workspaceId, ws.id)).orderBy(asc(modulesT.displayOrder)),
    db.select().from(lessonsT).where(eq(lessonsT.workspaceId, ws.id)).orderBy(asc(lessonsT.displayOrder)),
    db.select().from(exercisesT).where(eq(exercisesT.workspaceId, ws.id)).orderBy(asc(exercisesT.displayOrder)),
    db.select().from(labsT).where(eq(labsT.workspaceId, ws.id)).orderBy(asc(labsT.displayOrder)),
    db.select().from(userLevelProgress).where(and(eq(userLevelProgress.workspaceId, ws.id), eq(userLevelProgress.userId, user.id))),
  ]);

  // Group lessons/modules/exercises/labs by parent
  const exercisesByLesson = new Map<string, typeof allExercises>();
  for (const e of allExercises) {
    if (!exercisesByLesson.has(e.lessonId)) exercisesByLesson.set(e.lessonId, []);
    exercisesByLesson.get(e.lessonId)!.push(e);
  }
  const lessonsByModule = new Map<string, typeof allLessons>();
  for (const l of allLessons) {
    if (!lessonsByModule.has(l.moduleId)) lessonsByModule.set(l.moduleId, []);
    lessonsByModule.get(l.moduleId)!.push(l);
  }
  const modulesByWeek = new Map<string, typeof allModules>();
  for (const m of allModules) {
    if (!modulesByWeek.has(m.weekId)) modulesByWeek.set(m.weekId, []);
    modulesByWeek.get(m.weekId)!.push(m);
  }
  const labsByWeek = new Map<string, typeof allLabs>();
  for (const lab of allLabs) {
    if (!labsByWeek.has(lab.weekId)) labsByWeek.set(lab.weekId, []);
    labsByWeek.get(lab.weekId)!.push(lab);
  }
  const lvlStatusByCode = new Map(userLvls.map((l) => [l.levelCode, l.status ?? 'locked']));

  // Build nested tree
  const treeTracks: TreeTrack[] = tracks.map((t, ti) => {
    const trackWeeks = allWeeks.filter((w) => w.trackId === t.id);
    const isUnlocked = (lvlStatusByCode.get(t.levelCode) ?? (ti === 0 ? 'unlocked' : 'locked')) !== 'locked';
    return {
      id: t.id,
      levelCode: t.levelCode,
      title: t.title,
      description: t.description,
      unlocked: isUnlocked,
      weeks: trackWeeks.map((w) => ({
        id: w.id,
        weekIndex: w.weekIndex,
        title: w.title,
        summary: w.summary,
        goals: w.goals ?? [],
        keywords: w.keywords ?? [],
        estHours: w.estHours,
        modules: (modulesByWeek.get(w.id) ?? []).map((m) => ({
          id: m.id,
          title: m.title,
          summary: m.summary,
          lessons: (lessonsByModule.get(m.id) ?? []).map((l) => ({
            id: l.id,
            slug: l.slug,
            title: l.title,
            estMinutes: l.estMinutes,
            introMd: l.introMd,
            exercises: (exercisesByLesson.get(l.id) ?? []).map((e) => ({
              id: e.id,
              kind: e.kind,
              promptMd: e.promptMd,
            })),
          })),
        })),
        labs: (labsByWeek.get(w.id) ?? []).map((lab) => ({
          id: lab.id,
          title: lab.title,
          description: lab.description,
          estMinutes: lab.estMinutes,
        })),
      })),
    };
  });

  // Aggregate stats for header
  const totalWeeks = treeTracks.reduce((n, t) => n + t.weeks.length, 0);
  const totalModules = allModules.length;
  const totalLessons = allLessons.length;
  const totalExercises = allExercises.length;
  const totalLabs = allLabs.length;

  return (
    <div className="mx-auto max-w-5xl p-6 md:p-8 space-y-6">
      <header className="flex items-center gap-3">
        <Network className="size-7 text-violet-400" />
        <div className="flex-1">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Roadmap Tree</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Tier 1 Career Level → Tier 2 Weeks → Tier 3 Modules · Lessons · Labs · Exercises
          </p>
        </div>
      </header>

      <div className="surface p-4 grid grid-cols-2 md:grid-cols-5 gap-3 text-center">
        <Stat label="Tracks" value={treeTracks.length} />
        <Stat label="Weeks" value={totalWeeks} />
        <Stat label="Modules" value={totalModules} />
        <Stat label="Lessons" value={totalLessons} />
        <Stat label="Labs" value={totalLabs} />
      </div>

      <div className="text-xs text-muted-foreground">
        {totalExercises} interactive exercises across {totalLessons} lessons — click any week to deep-dive.
      </div>

      {treeTracks.length === 0 ? (
        <div className="surface p-12 text-center text-muted-foreground">
          No roadmap data yet. Run ETL import or db:seed + bootstrap-full-workspace.
        </div>
      ) : (
        <RoadmapTree workspaceSlug={ws.slug} tracks={treeTracks} />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-2xl font-bold tabular-nums accent-gradient-text">{value}</div>
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
    </div>
  );
}
