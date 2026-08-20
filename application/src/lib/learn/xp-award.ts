/**
 * XP awarding primitives — pure data-layer helpers shared by learn actions.
 *
 * Extracted from actions/learn.ts so the action file only orchestrates:
 * Single Responsibility (persistence/idempotency lives here, flow lives there).
 */

import { and, eq, inArray, count, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { exercises, userExerciseAttempts, xpEvents } from '@/lib/db/schema';
import { tickStreak, type StreakTickResult } from '@/lib/gamification/streak';
import { XP, streakMilestoneBonus } from './xp-rules';

export type XpOnceParams = {
  workspaceId: string;
  userId: string;
  amount: number;
  reason: string;
  refKind: string;
  refId: string;
};

/**
 * Insert an xp_event at most once per (workspace, user, refKind, refId, reason)
 * using a single guarded INSERT…SELECT — atomic without a unique constraint,
 * so replays / concurrent duplicates cannot double-award.
 * Returns true when a new row was actually inserted.
 */
export async function insertXpOnce(params: XpOnceParams): Promise<boolean> {
  const res = await db.execute(sql`
    INSERT INTO xp_events (id, workspace_id, user_id, amount, reason, ref_kind, ref_id)
    SELECT gen_random_uuid(), ${params.workspaceId}::uuid, ${params.userId}::uuid,
           ${params.amount}, ${params.reason}, ${params.refKind}, ${params.refId}::uuid
    WHERE NOT EXISTS (
      SELECT 1 FROM xp_events
      WHERE workspace_id = ${params.workspaceId}::uuid
        AND user_id = ${params.userId}::uuid
        AND ref_kind = ${params.refKind}
        AND ref_id = ${params.refId}::uuid
        AND reason = ${params.reason}
    )
    RETURNING id
  `);
  return res.length === 1;
}

export type StreakReward = StreakTickResult & {
  /** XP paid for the daily tick + any milestone bonus (0 when already ticked). */
  xpAwarded: number;
};

/**
 * Tick the learning streak and pay the XP it earns.
 *
 * `tickStreak` is already idempotent per (Vietnamese) day via a conditional
 * UPDATE, so gating the XP inserts on `ticked` makes them idempotent too —
 * no unique index needed. Called by every "the user did something today"
 * path (node done, daily task done) so the streak is not a lesson-only
 * concept. Flow F: daily tick +5, 7-day +50, 30-day +300.
 */
export async function awardStreakTick(
  workspaceId: string,
  userId: string,
): Promise<StreakReward> {
  const streak = await tickStreak(workspaceId, userId);
  if (!streak.ticked) return { ...streak, xpAwarded: 0 };

  const rows: Array<typeof xpEvents.$inferInsert> = [
    { workspaceId, userId, amount: XP.DAILY_STREAK_TICK, reason: 'daily_streak' },
  ];
  const milestone = streakMilestoneBonus(streak.newStreak);
  if (milestone > 0) {
    rows.push({
      workspaceId,
      userId,
      amount: milestone,
      reason: 'streak_milestone',
      refKind: 'streak',
    });
  }
  await db.insert(xpEvents).values(rows);
  return { ...streak, xpAwarded: XP.DAILY_STREAK_TICK + milestone };
}

/**
 * Compute a lesson score SERVER-SIDE from recorded attempts:
 * distinct correct exercises / total exercises in the lesson.
 * Never trust the client's scorePct — this is the source of truth.
 * Returns null when the lesson has no exercises (caller keeps its input).
 */
export async function computeLessonScore(
  workspaceId: string,
  userId: string,
  lessonId: string,
): Promise<number | null> {
  const lessonExercises = await db
    .select({ id: exercises.id })
    .from(exercises)
    .where(eq(exercises.lessonId, lessonId));
  if (lessonExercises.length === 0) return null;

  const correctRows = await db
    .select({ exerciseId: userExerciseAttempts.exerciseId })
    .from(userExerciseAttempts)
    .where(
      and(
        eq(userExerciseAttempts.workspaceId, workspaceId),
        eq(userExerciseAttempts.userId, userId),
        inArray(
          userExerciseAttempts.exerciseId,
          lessonExercises.map((e) => e.id),
        ),
        eq(userExerciseAttempts.isCorrect, true),
      ),
    );
  const distinctCorrect = new Set(correctRows.map((r) => r.exerciseId)).size;
  return Math.min(1, distinctCorrect / lessonExercises.length);
}

/** Count a user's prior attempts for an exercise (server-side retry detection). */
export async function countPriorAttempts(
  workspaceId: string,
  userId: string,
  exerciseId: string,
): Promise<number> {
  const rows = await db
    .select({ n: count() })
    .from(userExerciseAttempts)
    .where(
      and(
        eq(userExerciseAttempts.workspaceId, workspaceId),
        eq(userExerciseAttempts.userId, userId),
        eq(userExerciseAttempts.exerciseId, exerciseId),
      ),
    );
  return Number(rows[0]?.n ?? 0);
}

/** Whether the user already has at least one CORRECT attempt for an exercise. */
export async function hasCorrectAttempt(
  workspaceId: string,
  userId: string,
  exerciseId: string,
): Promise<boolean> {
  const rows = await db
    .select({ n: count() })
    .from(userExerciseAttempts)
    .where(
      and(
        eq(userExerciseAttempts.workspaceId, workspaceId),
        eq(userExerciseAttempts.userId, userId),
        eq(userExerciseAttempts.exerciseId, exerciseId),
        eq(userExerciseAttempts.isCorrect, true),
      ),
    );
  return Number(rows[0]?.n ?? 0) > 0;
}
