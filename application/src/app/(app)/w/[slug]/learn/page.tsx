/**
 * Course Map page — Duolingo-style curved path of weeks, grouped by Level.
 */
import { eq, asc, and, inArray } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import {
  weeks,
  levelTracks,
  userLevelProgress,
  userWeekProgress,
  modules as modulesT,
  lessons,
  userLessonProgress,
} from '@/lib/db/schema';
import { requireWorkspaceAccess } from '@/lib/workspace';
import { requireUser } from '@/lib/auth/supabase-server';
import { LevelBadge } from '@/components/skills/level-badge';
import { Lock, GraduationCap, ChevronDown } from 'lucide-react';
import { CoursePath, type WeekNodeData } from '@/components/learn/course-path';

export default async function LearnPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ws = await requireWorkspaceAccess(slug);
  const user = await requireUser();

  const [tracks, allWeeks, userLvl, userWkRows] = await Promise.all([
    db
      .select()
      .from(levelTracks)
      .where(eq(levelTracks.workspaceId, ws.id))
      .orderBy(asc(levelTracks.displayOrder)),
    db
      .select()
      .from(weeks)
      .where(eq(weeks.workspaceId, ws.id))
      .orderBy(asc(weeks.weekIndex)),
    db
      .select()
      .from(userLevelProgress)
      .where(
        and(eq(userLevelProgress.workspaceId, ws.id), eq(userLevelProgress.userId, user.id)),
      ),
    db
      .select()
      .from(userWeekProgress)
      .where(
        and(eq(userWeekProgress.workspaceId, ws.id), eq(userWeekProgress.userId, user.id)),
      ),
  ]);

  const lvlStatusByCode = new Map(userLvl.map((l) => [l.levelCode, l.status ?? 'locked']));
  const wkProgressById = new Map(userWkRows.map((w) => [w.weekId, w]));

  // Determine in-progress lessons (any progress row not yet completed/mastered)
  const allWeekIds = allWeeks.map((w) => w.id);
  const lessonRows = allWeekIds.length
    ? await db
        .select({ lessonId: lessons.id, weekId: modulesT.weekId })
        .from(lessons)
        .innerJoin(modulesT, eq(modulesT.id, lessons.moduleId))
        .where(inArray(modulesT.weekId, allWeekIds))
    : [];
  const lessonsByWeek = new Map<string, string[]>();
  for (const l of lessonRows) {
    if (!lessonsByWeek.has(l.weekId)) lessonsByWeek.set(l.weekId, []);
    lessonsByWeek.get(l.weekId)!.push(l.lessonId);
  }
  const lessonProgress = lessonRows.length
    ? await db
        .select()
        .from(userLessonProgress)
        .where(
          and(
            eq(userLessonProgress.workspaceId, ws.id),
            eq(userLessonProgress.userId, user.id),
            inArray(
              userLessonProgress.lessonId,
              lessonRows.map((l) => l.lessonId),
            ),
          ),
        )
    : [];
  const progressByLessonId = new Map(lessonProgress.map((p) => [p.lessonId, p.status]));

  return (
    <div className="mx-auto max-w-4xl p-6 md:p-8 space-y-10">
      <header className="flex items-center gap-3">
        <GraduationCap className="size-7 text-violet-400" />
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Course Map</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {allWeeks.length} weeks · {tracks.length} levels · climb the path
          </p>
        </div>
      </header>

      {tracks.length === 0 && (
        <div className="surface p-12 text-center text-muted-foreground">
          No course content yet. Re-fork the framework template.
        </div>
      )}

      {tracks.map((track, ti) => {
        const trackWeeks = allWeeks.filter((w) => w.trackId === track.id);
        const lvlStatus = lvlStatusByCode.get(track.levelCode) ?? (ti === 0 ? 'unlocked' : 'locked');
        const isLocked = lvlStatus === 'locked';

        const nodeData: WeekNodeData[] = trackWeeks.map((w, i) => {
          const wkRow = wkProgressById.get(w.id);
          const lessonIds = lessonsByWeek.get(w.id) ?? [];
          const states = lessonIds.map((id) => progressByLessonId.get(id));
          const hasMastered = states.some((s) => s === 'mastered');
          const allMastered = lessonIds.length > 0 && states.every((s) => s === 'mastered');
          const completedFlag = !!wkRow?.completedAt;
          const inProgressFlag = !completedFlag && states.some((s) => s !== undefined);

          let status: WeekNodeData['status'];
          if (isLocked && i > 0) {
            status = 'locked';
          } else if (i === 0 && !wkRow?.unlocked && isLocked) {
            status = 'locked';
          } else {
            // Week unlock if level unlocked and week 1, or wkRow.unlocked true (previously unlocked)
            const weekUnlocked =
              !isLocked && (i === 0 || wkRow?.unlocked === true);
            if (!weekUnlocked) status = 'locked';
            else if (allMastered) status = 'mastered';
            else if (completedFlag) status = 'completed';
            else if (inProgressFlag) status = 'in_progress';
            else status = 'unlocked';
          }

          return {
            id: w.id,
            weekIndex: w.weekIndex,
            title: w.title,
            status,
            href: `/w/${slug}/learn/${track.levelCode}/${w.weekIndex}`,
          };
        });

        const completedCount = nodeData.filter((n) => n.status === 'completed' || n.status === 'mastered').length;
        const pct = nodeData.length > 0 ? Math.round((completedCount / nodeData.length) * 100) : 0;

        return (
          <section key={track.id} className="space-y-6">
            <header className="surface p-4 flex items-center gap-3 overflow-hidden relative">
              <div
                className="absolute inset-y-0 left-0 accent-gradient opacity-10"
                style={{ width: `${pct}%` }}
              />
              <LevelBadge code={track.levelCode} showLabel size="lg" />
              <div className="flex-1 relative">
                <h2 className="text-lg font-semibold">{track.title}</h2>
                <p className="text-xs text-muted-foreground">
                  {completedCount}/{nodeData.length} weeks · {pct}%
                </p>
              </div>
              {isLocked && (
                <span className="text-xs text-muted-foreground flex items-center gap-1 relative">
                  <Lock className="size-3" />
                  Locked
                </span>
              )}
            </header>

            <CoursePath weeks={nodeData} />
          </section>
        );
      })}
    </div>
  );
}
