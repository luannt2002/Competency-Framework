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
  weekCompleted: boolean;
  levelCompleted: boolean;
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
    .where(eq(lessons.id, lessonId))
    .limit(1);
  if (!lessonRows[0]) return empty();

  const modRows = await db
    .select({ weekId: modules.weekId })
    .from(modules)
    .where(eq(modules.id, lessonRows[0].moduleId))
    .limit(1);
  if (!modRows[0]) return empty();

  const weekRows = await db
    .select()
    .from(weeks)
    .where(eq(weeks.id, modRows[0].weekId))
    .limit(1);
  const wk = weekRows[0];
  if (!wk) return empty();

  // 2. Compute week pct
  const allModulesOfWeek = await db
    .select({ id: modules.id })
    .from(modules)
    .where(eq(modules.weekId, wk.id));
  const moduleIds = allModulesOfWeek.map((m) => m.id);

  const allLessonsOfWeek = moduleIds.length
    ? await db.select({ id: lessons.id }).from(lessons).where(inArray(lessons.moduleId, moduleIds))
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
  const weekJustCompleted = pct >= 0.8;

  // 3. Upsert user_week_progress
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

  if (existingWeek[0]) {
    await db
      .update(userWeekProgress)
      .set({
        pctComplete: String(pct),
        unlocked: true,
        completedAt: weekJustCompleted && !existingWeek[0].completedAt ? new Date() : existingWeek[0].completedAt,
      })
      .where(eq(userWeekProgress.id, existingWeek[0].id));
  } else {
    await db.insert(userWeekProgress).values({
      workspaceId,
      userId,
      weekId: wk.id,
      pctComplete: String(pct),
      unlocked: true,
      unlockedAt: new Date(),
      completedAt: weekJustCompleted ? new Date() : null,
    });
  }

  // 4. If week completed → unlock next week in same track
  const newlyUnlockedWeekIds: string[] = [];
  if (weekJustCompleted) {
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
    .where(eq(weeks.trackId, wk.trackId));

  const completedWeeksInTrack = await db
    .select({ id: userWeekProgress.id })
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
  // Count completedAt not null among above
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
    .where(eq(levelTracks.id, wk.trackId))
    .limit(1);
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
        .where(eq(userLevelProgress.id, lvlExisting[0].id));
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
          .where(eq(userLevelProgress.id, nextLvlExisting[0].id));
        newlyUnlockedLevelCodes.push(nextTrack.levelCode);
      }
    }
  }

  return {
    weekCompleted: weekJustCompleted,
    levelCompleted: levelJustCompleted,
    newlyUnlockedWeekIds,
    newlyUnlockedLevelCodes,
  };
}

function empty(): UnlockResult {
  return {
    weekCompleted: false,
    levelCompleted: false,
    newlyUnlockedWeekIds: [],
    newlyUnlockedLevelCodes: [],
  };
}
