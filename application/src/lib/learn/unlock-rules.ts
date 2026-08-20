/**
 * Week / Level unlock recomputation. Called after completeLesson.
 *
 * Rules:
 *   - Week pct_complete = completed lessons / total lessons in that week
 *   - Week completed when pct_complete >= 0.8
 *   - Next week unlocks when previous week completed
 *   - Level completed when ALL weeks in track completed
 *   - Next level unlocks when current level completed
 */
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import {
  lessons,
  modules,
  weeks,
  levelTracks,
  userLessonProgress,
  userWeekProgress,
  userLevelProgress,
} from '@/lib/db/schema';

export type UnlockResult = {
  /** True only on the transition where the week becomes completed for the first time. */
  weekCompleted: boolean;
  /** True only on the transition where the level becomes completed for the first time. */
  levelCompleted: boolean;
  completedWeekId: string | null;
  completedTrackId: string | null;
  newlyUnlockedWeekIds: string[];
  newlyUnlockedLevelCodes: string[];
};

export async function recomputeUnlocks(
  workspaceId: string,
  userId: string,
  lessonId: string,
): Promise<UnlockResult> {
  // 1. Resolve lesson → module → week → track
  const lessonRows = await db
    .select({ moduleId: lessons.moduleId })
    .from(lessons)
    .where(and(eq(lessons.id, lessonId), eq(lessons.workspaceId, workspaceId)))
    .limit(1);
  if (!lessonRows[0]) return empty();

  const modRows = await db
    .select({ weekId: modules.weekId })
    .from(modules)
    .where(and(eq(modules.id, lessonRows[0].moduleId), eq(modules.workspaceId, workspaceId)))
    .limit(1);
  if (!modRows[0]) return empty();

  const weekRows = await db
    .select()
    .from(weeks)
    .where(and(eq(weeks.id, modRows[0].weekId), eq(weeks.workspaceId, workspaceId)))
    .limit(1);
  const wk = weekRows[0];
  if (!wk) return empty();

  // 2. Compute week pct
  const allModulesOfWeek = await db
    .select({ id: modules.id })
    .from(modules)
    .where(and(eq(modules.weekId, wk.id), eq(modules.workspaceId, workspaceId)));
  const moduleIds = allModulesOfWeek.map((m) => m.id);

  const allLessonsOfWeek = moduleIds.length
    ? await db
        .select({ id: lessons.id })
        .from(lessons)
        .where(
          and(
            inArray(lessons.moduleId, moduleIds),
            eq(lessons.workspaceId, workspaceId),
          ),
        )
    : [];
  const totalLessons = allLessonsOfWeek.length;

  const completedLessons = totalLessons
    ? await db
        .select({ id: userLessonProgress.id })
        .from(userLessonProgress)
        .where(
          and(
            eq(userLessonProgress.workspaceId, workspaceId),
            eq(userLessonProgress.userId, userId),
            inArray(
              userLessonProgress.lessonId,
              allLessonsOfWeek.map((l) => l.id),
            ),
            inArray(userLessonProgress.status, ['completed', 'mastered']),
          ),
        )
    : [];

  const pct = totalLessons === 0 ? 0 : completedLessons.length / totalLessons;
  const pctReached = pct >= 0.8;

  // 3. Upsert user_week_progress
  // weekCompleted reports the FIRST transition to completed only — replaying
  // lessons in an already-completed week must not re-fire completion bonuses.
  const existingWeek = await db
    .select()
    .from(userWeekProgress)
    .where(
      and(
        eq(userWeekProgress.workspaceId, workspaceId),
        eq(userWeekProgress.userId, userId),
        eq(userWeekProgress.weekId, wk.id),
      ),
    )
    .limit(1);

  const weekJustCompleted = pctReached && !existingWeek[0]?.completedAt;

  if (existingWeek[0]) {
    await db
      .update(userWeekProgress)
      .set({
        pctComplete: String(pct),
        unlocked: true,
        completedAt: pctReached && !existingWeek[0].completedAt ? new Date() : existingWeek[0].completedAt,
      })
      .where(
        and(
          eq(userWeekProgress.id, existingWeek[0].id),
          eq(userWeekProgress.workspaceId, workspaceId),
        ),
      );
  } else {
    await db.insert(userWeekProgress).values({
      workspaceId,
      userId,
      weekId: wk.id,
      pctComplete: String(pct),
      unlocked: true,
      unlockedAt: new Date(),
      completedAt: pctReached ? new Date() : null,
    });
  }

  // 4. If week completed → unlock next week in same track
  const newlyUnlockedWeekIds: string[] = [];
  if (pctReached) {
    const nextWeekRows = await db
      .select()
      .from(weeks)
      .where(
        and(
          eq(weeks.workspaceId, workspaceId),
          eq(weeks.trackId, wk.trackId),
          eq(weeks.weekIndex, wk.weekIndex + 1),
        ),
      )
      .limit(1);
    const nextWk = nextWeekRows[0];
    if (nextWk) {
      const existsNext = await db
        .select({ id: userWeekProgress.id })
        .from(userWeekProgress)
        .where(
          and(
            eq(userWeekProgress.workspaceId, workspaceId),
            eq(userWeekProgress.userId, userId),
            eq(userWeekProgress.weekId, nextWk.id),
          ),
        )
        .limit(1);
      if (!existsNext[0]) {
        await db.insert(userWeekProgress).values({
          workspaceId,
          userId,
          weekId: nextWk.id,
          unlocked: true,
          unlockedAt: new Date(),
        });
        newlyUnlockedWeekIds.push(nextWk.id);
      }
    }
  }

  // 5. Check level completion
  const allWeeksInTrack = await db
    .select({ id: weeks.id })
    .from(weeks)
    .where(and(eq(weeks.trackId, wk.trackId), eq(weeks.workspaceId, workspaceId)));

  // Count completedAt not null among weeks in track
  const completedCount = await db
    .select()
    .from(userWeekProgress)
    .where(
      and(
        eq(userWeekProgress.workspaceId, workspaceId),
        eq(userWeekProgress.userId, userId),
        inArray(
          userWeekProgress.weekId,
          allWeeksInTrack.map((w) => w.id),
        ),
      ),
    );
  const completedDoneCount = completedCount.filter((r) => r.completedAt !== null).length;
  const levelJustCompleted = completedDoneCount >= allWeeksInTrack.length && allWeeksInTrack.length > 0;

  const newlyUnlockedLevelCodes: string[] = [];

  // Resolve the track's level code
  const trackRow = await db
    .select()
    .from(levelTracks)
    .where(and(eq(levelTracks.id, wk.trackId), eq(levelTracks.workspaceId, workspaceId)))
    .limit(1);

  // First-time level completion only (prevents infinite +500 XP re-awards).
  let levelAlreadyCompleted = false;
  if (trackRow[0]) {
    const lvlExisting = await db
      .select()
      .from(userLevelProgress)
      .where(
        and(
          eq(userLevelProgress.workspaceId, workspaceId),
          eq(userLevelProgress.userId, userId),
          eq(userLevelProgress.levelCode, trackRow[0].levelCode),
        ),
      )
      .limit(1);
    levelAlreadyCompleted = lvlExisting[0]?.status === 'completed';
  }
  const levelFirstCompleted = levelJustCompleted && !levelAlreadyCompleted;

  if (trackRow[0] && levelJustCompleted) {
    // Mark level completed
    const lvlExisting = await db
      .select()
      .from(userLevelProgress)
      .where(
        and(
          eq(userLevelProgress.workspaceId, workspaceId),
          eq(userLevelProgress.userId, userId),
          eq(userLevelProgress.levelCode, trackRow[0].levelCode),
        ),
      )
      .limit(1);
    if (lvlExisting[0] && lvlExisting[0].status !== 'completed') {
      await db
        .update(userLevelProgress)
        .set({ status: 'completed', completedAt: new Date() })
        .where(
          and(
            eq(userLevelProgress.id, lvlExisting[0].id),
            eq(userLevelProgress.workspaceId, workspaceId),
          ),
        );
    }

    // Unlock next level (by displayOrder)
    const allTracks = await db
      .select()
      .from(levelTracks)
      .where(eq(levelTracks.workspaceId, workspaceId));
    const sorted = allTracks
      .slice()
      .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
    const idx = sorted.findIndex((t) => t.id === trackRow[0]!.id);
    const nextTrack = idx >= 0 ? sorted[idx + 1] : undefined;
    if (nextTrack) {
      const nextLvlExisting = await db
        .select()
        .from(userLevelProgress)
        .where(
          and(
            eq(userLevelProgress.workspaceId, workspaceId),
            eq(userLevelProgress.userId, userId),
            eq(userLevelProgress.levelCode, nextTrack.levelCode),
          ),
        )
        .limit(1);
      if (nextLvlExisting[0] && nextLvlExisting[0].status === 'locked') {
        await db
          .update(userLevelProgress)
          .set({ status: 'unlocked', unlockedAt: new Date() })
          .where(
            and(
              eq(userLevelProgress.id, nextLvlExisting[0].id),
              eq(userLevelProgress.workspaceId, workspaceId),
            ),
          );
        newlyUnlockedLevelCodes.push(nextTrack.levelCode);
      }
    }
  }

  return {
    weekCompleted: weekJustCompleted,
    levelCompleted: levelFirstCompleted,
    completedWeekId: weekJustCompleted ? wk.id : null,
    completedTrackId: levelFirstCompleted && trackRow[0] ? trackRow[0].id : null,
    newlyUnlockedWeekIds,
    newlyUnlockedLevelCodes,
  };
}

function empty(): UnlockResult {
  return {
    weekCompleted: false,
    levelCompleted: false,
    completedWeekId: null,
    completedTrackId: null,
    newlyUnlockedWeekIds: [],
    newlyUnlockedLevelCodes: [],
  };
}
