/**
 * Lesson runner server actions.
 * - startLesson: load lesson + exercises, init user_lesson_progress
 * - submitExercise: evaluate, award XP, decrement hearts on wrong
 * - completeLesson: bonus XP, tick streak, mark progress
 */
'use server';
import { resolveWorkspace } from '@/lib/rbac/resolve';

import { z } from 'zod';
import { eq, and, asc, inArray, count, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db/client';
import {
  lessons,
  exercises,
  userLessonProgress,
  userExerciseAttempts,
  xpEvents,
  hearts,
  workspaces,
  activityLog,
} from '@/lib/db/schema';
import { requireUser } from '@/lib/auth/supabase-server';
import { evaluateExercise, type ExerciseKind } from '@/lib/learn/exercise-evaluator';
import { XP } from '@/lib/learn/xp-rules';
import { tickStreak } from '@/lib/gamification/streak';
import { awardCrowns, type CrownAdvance } from '@/lib/gamification/crowns';
import { evaluateBadges, type GrantedBadge } from '@/lib/gamification/badge-evaluator';
import { recomputeUnlocks } from '@/lib/learn/unlock-rules';
import {
  insertXpOnce,
  computeLessonScore,
  countPriorAttempts,
  hasCorrectAttempt,
} from '@/lib/learn/xp-award';
import { RBAC_LEVELS } from '@/lib/rbac/levels';
import { requireMinLevel, writeAudit, RBACError } from '@/lib/rbac/server';


export type LessonRunData = {
  lessonId: string;
  title: string;
  introMd: string | null;
  estMinutes: number;
  exercises: Array<{
    id: string;
    kind: ExerciseKind;
    promptMd: string;
    /** Public payload (correct answer stripped if applicable). */
    payload: unknown;
    xpAward: number;
  }>;
};

const startInput = z.object({
  workspaceSlug: z.string(),
  lessonId: z.string().uuid(),
});

export async function startLesson(input: z.infer<typeof startInput>): Promise<LessonRunData> {
  const { workspaceSlug, lessonId } = startInput.parse(input);
  // Learners need to write their own progress row → LEARNER level.
  const { ws, user } = await resolveWorkspace(workspaceSlug, RBAC_LEVELS.LEARNER);

  const lessonRows = await db
    .select()
    .from(lessons)
    .where(and(eq(lessons.id, lessonId), eq(lessons.workspaceId, ws.id)))
    .limit(1);
  const lesson = lessonRows[0];
  if (!lesson) throw new Error('LESSON_NOT_FOUND');

  const exerciseRows = await db
    .select()
    .from(exercises)
    .where(eq(exercises.lessonId, lesson.id))
    .orderBy(asc(exercises.displayOrder));

  // Init or bump user_lesson_progress
  const existing = await db
    .select({ id: userLessonProgress.id, attempts: userLessonProgress.attempts })
    .from(userLessonProgress)
    .where(
      and(
        eq(userLessonProgress.workspaceId, ws.id),
        eq(userLessonProgress.userId, user.id),
        eq(userLessonProgress.lessonId, lesson.id),
      ),
    )
    .limit(1);

  if (existing[0]) {
    await db
      .update(userLessonProgress)
      .set({
        status: 'in_progress',
        attempts: (existing[0].attempts ?? 0) + 1,
        lastAttemptAt: new Date(),
      })
      .where(eq(userLessonProgress.id, existing[0].id));
  } else {
    await db.insert(userLessonProgress).values({
      workspaceId: ws.id,
      userId: user.id,
      lessonId: lesson.id,
      status: 'in_progress',
      attempts: 1,
      lastAttemptAt: new Date(),
    });
  }

  return {
    lessonId: lesson.id,
    title: lesson.title,
    introMd: lesson.introMd ?? null,
    estMinutes: lesson.estMinutes ?? 8,
    exercises: exerciseRows.map((e) => ({
      id: e.id,
      kind: e.kind,
      promptMd: e.promptMd,
      // Strip server-only correct answer fields for safety
      payload: stripCorrect(e.kind, e.payload),
      xpAward: e.xpAward ?? 10,
    })),
  };
}

function stripCorrect(kind: ExerciseKind, payload: unknown): unknown {
  if (!payload || typeof payload !== 'object') return payload;
  const p = { ...(payload as Record<string, unknown>) };
  if (kind === 'mcq' || kind === 'code_block_review') delete p.correctId;
  if (kind === 'mcq_multi') delete p.correctIds;
  if (kind === 'fill_blank') {
    const blanks = (p.blanks as Array<Record<string, unknown>>)?.map((b) => ({
      id: b.id,
      // keep matchKind for client hint; strip accepts
    }));
    p.blanks = blanks;
  }
  if (kind === 'order_steps') delete p.correctOrder;
  if (kind === 'type_answer') {
    delete p.accepts;
    // keep `hint`
  }
  return p;
}

const submitInput = z.object({
  workspaceSlug: z.string(),
  lessonId: z.string().uuid(),
  exerciseId: z.string().uuid(),
  answer: z.unknown(),
  timeTakenMs: z.number().int().min(0).max(60 * 60 * 1000).optional(),
  isRetry: z.boolean().optional(),
});

export type SubmitResult = {
  isCorrect: boolean;
  explanationMd: string | null;
  xpAwarded: number;
  heartsLeft: number;
};

export async function submitExercise(input: z.infer<typeof submitInput>): Promise<SubmitResult> {
  const parsed = submitInput.parse(input);
  const { ws, user, ctx } = await resolveWorkspace(parsed.workspaceSlug, RBAC_LEVELS.LEARNER);

  const exRows = await db
    .select()
    .from(exercises)
    .where(and(eq(exercises.id, parsed.exerciseId), eq(exercises.workspaceId, ws.id)))
    .limit(1);
  const ex = exRows[0];
  if (!ex) throw new Error('EXERCISE_NOT_FOUND');

  const isCorrect = evaluateExercise(ex.kind, ex.payload, parsed.answer);

  // Server-side retry detection: prior attempts decide retry status, NOT the client.
  // (Client `isRetry` is advisory only — trusting it allowed full first-try XP forever.)
  const isServerRetry =
    (await countPriorAttempts(ws.id, user.id, ex.id)) > 0;

  // XP is awarded at most once per exercise (first correct attempt ever).
  // Re-submitting a correct answer awards nothing → no XP farming via replay.
  let xpAwarded = 0;
  if (isCorrect && !isServerRetry) {
    xpAwarded = ex.xpAward ?? XP.EXERCISE_CORRECT_FIRST;
    await db.insert(xpEvents).values({
      workspaceId: ws.id,
      userId: user.id,
      amount: xpAwarded,
      reason: 'exercise_correct',
      refKind: 'exercise',
      refId: ex.id,
    });
  } else if (isCorrect && isServerRetry) {
    // Retry-correct after at least one wrong attempt: small reward, once per exercise.
    if (!(await hasCorrectAttempt(ws.id, user.id, ex.id))) {
      xpAwarded = XP.EXERCISE_CORRECT_RETRY;
      await db.insert(xpEvents).values({
        workspaceId: ws.id,
        userId: user.id,
        amount: xpAwarded,
        reason: 'exercise_correct_retry',
        refKind: 'exercise',
        refId: ex.id,
      });
    }
  }

  // Record attempt
  await db.insert(userExerciseAttempts).values({
    workspaceId: ws.id,
    userId: user.id,
    exerciseId: ex.id,
    answer: parsed.answer as Record<string, unknown>,
    isCorrect,
    timeTakenMs: parsed.timeTakenMs ?? null,
  });

  // Update hearts (decrement on wrong) — single atomic upsert to avoid the
  // read-modify-write race where two concurrent wrong answers both read the
  // same heart count and only lose one heart.
  let heartsLeft = 5;
  if (!isCorrect) {
    const HEART_REFILL_MS = 4 * 60 * 60 * 1000;
    const upserted = await db
      .insert(hearts)
      .values({
        workspaceId: ws.id,
        userId: user.id,
        current: 4,
        max: 5,
        nextRefillAt: new Date(Date.now() + HEART_REFILL_MS),
      })
      .onConflictDoUpdate({
        target: [hearts.workspaceId, hearts.userId],
        set: {
          current: sql`GREATEST(${hearts.current} - 1, 0)`,
          nextRefillAt: sql`COALESCE(${hearts.nextRefillAt}, NOW() + interval '4 hours')`,
        },
      })
      .returning({ current: hearts.current });
    heartsLeft = upserted[0]?.current ?? 5;
  } else {
    const heartRows = await db
      .select({ current: hearts.current })
      .from(hearts)
      .where(and(eq(hearts.workspaceId, ws.id), eq(hearts.userId, user.id)))
      .limit(1);
    heartsLeft = heartRows[0]?.current ?? 5;
  }

  await writeAudit({
    workspaceId: ws.id,
    actorUserId: user.id,
    actorRole: ctx.role,
    action: 'exercise.submit',
    resourceType: 'exercise',
    resourceId: ex.id,
    before: null,
    after: { isCorrect, xpAwarded, isRetry: isServerRetry },
  });

  return {
    isCorrect,
    explanationMd: ex.explanationMd ?? null,
    xpAwarded,
    heartsLeft,
  };
}

const completeInput = z.object({
  workspaceSlug: z.string(),
  lessonId: z.string().uuid(),
  scorePct: z.number().min(0).max(1),
});

export type CompleteResult = {
  xpAwarded: number;
  bonusReason: 'lesson_complete' | 'lesson_mastered';
  streakTicked: boolean;
  newStreak: number;
  crowns: CrownAdvance[];
  badges: GrantedBadge[];
  weekCompleted: boolean;
  levelCompleted: boolean;
  newlyUnlockedLevelCodes: string[];
};


export async function completeLesson(input: z.infer<typeof completeInput>): Promise<CompleteResult> {
  const parsed = completeInput.parse(input);
  const { ws, user, ctx } = await resolveWorkspace(parsed.workspaceSlug, RBAC_LEVELS.LEARNER);

  // ===== Server-side score: derive from recorded attempts, never trust client =====
  const scorePct =
    (await computeLessonScore(ws.id, user.id, parsed.lessonId)) ?? parsed.scorePct;

  // Mark progress
  const mastered = scorePct >= 0.999;
  const existing = await db
    .select()
    .from(userLessonProgress)
    .where(
      and(
        eq(userLessonProgress.workspaceId, ws.id),
        eq(userLessonProgress.userId, user.id),
        eq(userLessonProgress.lessonId, parsed.lessonId),
      ),
    )
    .limit(1);

  // First-time transitions gate every XP bonus below (no re-award on replay).
  const prevStatus = existing[0]?.status ?? null;
  const firstCompletion = prevStatus !== 'completed' && prevStatus !== 'mastered';
  const firstMastery = mastered && prevStatus !== 'mastered';

  if (existing[0]) {
    await db
      .update(userLessonProgress)
      .set({
        status: mastered ? 'mastered' : 'completed',
        bestScore: String(Math.max(Number(existing[0].bestScore ?? '0'), scorePct)),
        completedAt: new Date(),
      })
      .where(eq(userLessonProgress.id, existing[0].id));
  } else {
    await db.insert(userLessonProgress).values({
      workspaceId: ws.id,
      userId: user.id,
      lessonId: parsed.lessonId,
      status: mastered ? 'mastered' : 'completed',
      bestScore: String(scorePct),
      attempts: 1,
      completedAt: new Date(),
      lastAttemptAt: new Date(),
    });
  }

  // Lesson bonus — only on the first completion, plus a one-time mastery upgrade.
  let bonus = 0;
  if (firstCompletion) {
    await insertXpOnce({
      workspaceId: ws.id,
      userId: user.id,
      amount: XP.LESSON_COMPLETE_BONUS,
      reason: 'lesson_complete',
      refKind: 'lesson',
      refId: parsed.lessonId,
    });
    bonus += XP.LESSON_COMPLETE_BONUS;
  }
  if (firstMastery) {
    const awarded = await insertXpOnce({
      workspaceId: ws.id,
      userId: user.id,
      amount: XP.LESSON_MASTERED_BONUS,
      reason: 'lesson_mastered',
      refKind: 'lesson',
      refId: parsed.lessonId,
    });
    if (awarded) bonus += XP.LESSON_MASTERED_BONUS;
  }

  // Tick streak
  const streak = await tickStreak(ws.id, user.id);
  if (streak.ticked) {
    await db.insert(xpEvents).values({
      workspaceId: ws.id,
      userId: user.id,
      amount: XP.DAILY_STREAK_TICK,
      reason: 'daily_streak',
    });
  }

  await db.insert(activityLog).values({
    workspaceId: ws.id,
    userId: user.id,
    kind: 'lesson_completed',
    payload: { lessonId: parsed.lessonId, scorePct, mastered },
  });

  // ===== Side effects: crowns + unlock + bonuses + badges =====
  // Crowns only advance on real transitions (first completion / first mastery)
  // — replaying a finished lesson must not keep stacking crowns to the cap.
  const crowns = await awardCrowns(ws.id, user.id, parsed.lessonId, mastered, {
    eligible: firstCompletion || firstMastery,
    masteredUpgrade: firstMastery && !firstCompletion,
  });
  const unlock = await recomputeUnlocks(ws.id, user.id, parsed.lessonId);

  let extraBonus = 0;
  if (unlock.weekCompleted) {
    extraBonus += XP.WEEK_COMPLETE_BONUS;
    await insertXpOnce({
      workspaceId: ws.id,
      userId: user.id,
      amount: XP.WEEK_COMPLETE_BONUS,
      reason: 'week_complete',
      refKind: 'week',
      refId: unlock.completedWeekId ?? parsed.lessonId,
    });
  }
  if (unlock.levelCompleted) {
    extraBonus += XP.LEVEL_COMPLETE_BONUS;
    await insertXpOnce({
      workspaceId: ws.id,
      userId: user.id,
      amount: XP.LEVEL_COMPLETE_BONUS,
      reason: 'level_complete',
      refKind: 'level',
      refId: unlock.completedTrackId ?? parsed.lessonId,
    });
  }

  const badgesEarned = await evaluateBadges(ws.id, user.id);

  await writeAudit({
    workspaceId: ws.id,
    actorUserId: user.id,
    actorRole: ctx.role,
    action: 'lesson.complete',
    resourceType: 'lesson',
    resourceId: parsed.lessonId,
    before: { status: existing[0]?.status ?? null },
    after: {
      status: mastered ? 'mastered' : 'completed',
      scorePct,
      weekCompleted: unlock.weekCompleted,
      levelCompleted: unlock.levelCompleted,
    },
  });

  revalidatePath(`/w/${ws.slug}`);
  revalidatePath(`/w/${ws.slug}/learn`);
  revalidatePath(`/w/${ws.slug}/skills`);

  return {
    xpAwarded: bonus + (streak.ticked ? XP.DAILY_STREAK_TICK : 0) + extraBonus +
      badgesEarned.length * XP.BADGE_EARNED,
    bonusReason: mastered ? 'lesson_mastered' : 'lesson_complete',
    streakTicked: streak.ticked,
    newStreak: streak.newStreak,
    crowns,
    badges: badgesEarned,
    weekCompleted: unlock.weekCompleted,
    levelCompleted: unlock.levelCompleted,
    newlyUnlockedLevelCodes: unlock.newlyUnlockedLevelCodes,
  };
}
