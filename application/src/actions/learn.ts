/**
 * Lesson runner server actions.
 * - startLesson: load lesson + exercises, init user_lesson_progress
 * - submitExercise: evaluate, award XP, decrement hearts on wrong
 * - completeLesson: bonus XP, tick streak, mark progress
 */
'use server';

import { z } from 'zod';
import { eq, and, asc } from 'drizzle-orm';
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

async function resolveWorkspace(slug: string, userId: string) {
  const rows = await db
    .select({ id: workspaces.id, slug: workspaces.slug })
    .from(workspaces)
    .where(and(eq(workspaces.slug, slug), eq(workspaces.ownerUserId, userId)))
    .limit(1);
  const ws = rows[0];
  if (!ws) throw new Error('WORKSPACE_NOT_FOUND_OR_FORBIDDEN');
  return ws;
}

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
  const user = await requireUser();
  const { workspaceSlug, lessonId } = startInput.parse(input);
  const ws = await resolveWorkspace(workspaceSlug, user.id);

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
  const user = await requireUser();
  const parsed = submitInput.parse(input);
  const ws = await resolveWorkspace(parsed.workspaceSlug, user.id);

  const exRows = await db
    .select()
    .from(exercises)
    .where(and(eq(exercises.id, parsed.exerciseId), eq(exercises.workspaceId, ws.id)))
    .limit(1);
  const ex = exRows[0];
  if (!ex) throw new Error('EXERCISE_NOT_FOUND');

  const isCorrect = evaluateExercise(ex.kind, ex.payload, parsed.answer);

  // Record attempt
  await db.insert(userExerciseAttempts).values({
    workspaceId: ws.id,
    userId: user.id,
    exerciseId: ex.id,
    answer: parsed.answer as Record<string, unknown>,
    isCorrect,
    timeTakenMs: parsed.timeTakenMs ?? null,
  });

  let xpAwarded = 0;
  if (isCorrect) {
    xpAwarded = parsed.isRetry ? XP.EXERCISE_CORRECT_RETRY : (ex.xpAward ?? XP.EXERCISE_CORRECT_FIRST);
    await db.insert(xpEvents).values({
      workspaceId: ws.id,
      userId: user.id,
      amount: xpAwarded,
      reason: parsed.isRetry ? 'exercise_correct_retry' : 'exercise_correct',
      refKind: 'exercise',
      refId: ex.id,
    });
  }

  // Update hearts (decrement on wrong)
  const heartRows = await db
    .select()
    .from(hearts)
    .where(and(eq(hearts.workspaceId, ws.id), eq(hearts.userId, user.id)))
    .limit(1);
  let heartsLeft = heartRows[0]?.current ?? 5;
  if (!isCorrect && heartsLeft > 0) {
    heartsLeft = heartsLeft - 1;
    await db
      .update(hearts)
      .set({
        current: heartsLeft,
        nextRefillAt: heartRows[0]?.nextRefillAt ?? new Date(Date.now() + 4 * 60 * 60 * 1000),
      })
      .where(and(eq(hearts.workspaceId, ws.id), eq(hearts.userId, user.id)));
  }

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
  const user = await requireUser();
  const parsed = completeInput.parse(input);
  const ws = await resolveWorkspace(parsed.workspaceSlug, user.id);

  // Mark progress
  const mastered = parsed.scorePct >= 0.999;
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

  if (existing[0]) {
    await db
      .update(userLessonProgress)
      .set({
        status: mastered ? 'mastered' : 'completed',
        bestScore: String(Math.max(Number(existing[0].bestScore ?? '0'), parsed.scorePct)),
        completedAt: new Date(),
      })
      .where(eq(userLessonProgress.id, existing[0].id));
  } else {
    await db.insert(userLessonProgress).values({
      workspaceId: ws.id,
      userId: user.id,
      lessonId: parsed.lessonId,
      status: mastered ? 'mastered' : 'completed',
      bestScore: String(parsed.scorePct),
      attempts: 1,
      completedAt: new Date(),
      lastAttemptAt: new Date(),
    });
  }

  const bonus = mastered ? XP.LESSON_MASTERED_BONUS : XP.LESSON_COMPLETE_BONUS;
  await db.insert(xpEvents).values({
    workspaceId: ws.id,
    userId: user.id,
    amount: bonus,
    reason: mastered ? 'lesson_mastered' : 'lesson_complete',
    refKind: 'lesson',
    refId: parsed.lessonId,
  });

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
    payload: { lessonId: parsed.lessonId, scorePct: parsed.scorePct, mastered },
  });

  // ===== Side effects: crowns + unlock + bonuses + badges =====
  const crowns = await awardCrowns(ws.id, user.id, parsed.lessonId, mastered);
  const unlock = await recomputeUnlocks(ws.id, user.id, parsed.lessonId);

  let extraBonus = 0;
  if (unlock.weekCompleted) {
    extraBonus += XP.WEEK_COMPLETE_BONUS;
    await db.insert(xpEvents).values({
      workspaceId: ws.id,
      userId: user.id,
      amount: XP.WEEK_COMPLETE_BONUS,
      reason: 'week_complete',
    });
  }
  if (unlock.levelCompleted) {
    extraBonus += XP.LEVEL_COMPLETE_BONUS;
    await db.insert(xpEvents).values({
      workspaceId: ws.id,
      userId: user.id,
      amount: XP.LEVEL_COMPLETE_BONUS,
      reason: 'level_complete',
    });
  }

  const badgesEarned = await evaluateBadges(ws.id, user.id);

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
