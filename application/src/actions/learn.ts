/**
 * Lesson runner server actions.
 * - startLesson: load lesson + exercises, init user_lesson_progress
 * - submitExercise: grade, award XP, decrement hearts on wrong
 * - completeLesson: bonus XP, tick streak, mark progress
 * - listGradingQueue / gradeSubmission: EDITOR+ manual grading (essay, rubric)
 *
 * Grading itself lives in `@/lib/exercises` (registry + domain). This file only
 * validates input, resolves the workspace, delegates, and audits.
 */
'use server';
import { resolveWorkspace } from '@/lib/rbac/resolve';

import { z } from 'zod';
import { eq, and, asc, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db/client';
import {
  lessons,
  userLessonProgress,
  xpEvents,
  hearts,
  activityLog,
  notifications,
} from '@/lib/db/schema';
import {
  openExercises as exercises,
  exerciseAttempts as userExerciseAttempts,
} from '@/lib/db/schema-exercises';
import { gradeAnswer } from '@/lib/exercises/registry';
import { sanitizePayload } from '@/lib/exercises/sanitize';
import { loadTypeResolver } from '@/lib/exercises/type-repo';
import { resolveExerciseType } from '@/lib/exercises/resolve';
import {
  listPendingAttempts,
  countPendingAttempts,
  gradeAttempt,
  type PendingAttempt,
} from '@/lib/exercises/grading';
import type { GradeResult, GradeStatus } from '@/lib/exercises/types';
import type { FieldSpec } from '@/lib/exercises/field-spec';
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
import { writeAudit } from '@/lib/rbac/server';


export type LessonRunData = {
  lessonId: string;
  title: string;
  introMd: string | null;
  estMinutes: number;
  exercises: Array<{
    /** Open kind slug — resolved via `exercise_types`, no longer an enum. */
    id: string;
    kind: string;
    /**
     * Resolved grading engine. The runner picks its widget from THIS, not from
     * `kind`: a tenant kind built on the `mcq` engine gets radio buttons even
     * though no code has ever heard of its slug. Safe to expose — it is a
     * registry key, not an answer (the grading queue already ships it).
     */
    engine: string;
    /** Human label of the kind, e.g. "Tự luận". */
    typeLabel: string;
    /** `manual`/`hybrid` tell the UI to promise a grade later, not a verdict now. */
    gradingMode: 'auto' | 'manual' | 'hybrid';
    promptMd: string;
    /** Public payload — every secret path stripped server-side. */
    payload: unknown;
    /**
     * Tenant-declared answer fields, secret ones removed. Empty for built-in
     * kinds; for a kind on an engine the runner has no widget for, this is
     * what it renders instead of giving up.
     */
    answerSpec: FieldSpec;
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
    .select({
      id: userLessonProgress.id,
      attempts: userLessonProgress.attempts,
      status: userLessonProgress.status,
    })
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
    // Re-opening a FINISHED lesson is a review, not a regression.
    //
    // This used to write 'in_progress' unconditionally. Nothing called
    // startLesson, so it never fired; the moment a runner exists, every visit
    // to a completed lesson would silently downgrade it — and three separate
    // readers key off exactly that value: unlock-rules re-locks a week whose
    // lessons are no longer all 'completed', badge-evaluator stops counting it,
    // and the daily planner resurrects it as unfinished work.
    const settled = existing[0].status === 'completed' || existing[0].status === 'mastered';
    await db
      .update(userLessonProgress)
      .set({
        status: settled ? existing[0].status : 'in_progress',
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

  // One catalogue read per lesson; kinds seen on rows are passed in so a kind
  // whose type row was retired still resolves via the code registry.
  const resolver = await loadTypeResolver(
    ws.id,
    exerciseRows.map((e) => e.kind),
  );

  return {
    lessonId: lesson.id,
    title: lesson.title,
    introMd: lesson.introMd ?? null,
    estMinutes: lesson.estMinutes ?? 8,
    exercises: exerciseRows.map((e) => {
      const type = resolver.get(e.kind) ?? resolveExerciseType(e.kind);
      return {
        id: e.id,
        kind: e.kind,
        engine: type.engine,
        typeLabel: type.label,
        gradingMode: type.gradingMode,
        promptMd: e.promptMd,
        // Answers never leave the server. `secretPaths` is the union of what
        // the engine declares and what the tenant flagged secret, so a kind
        // invented at runtime is stripped as thoroughly as a built-in one.
        payload: sanitizePayload(e.payload, { secretPaths: type.secretPaths }),
        answerSpec: type.answerSpec,
        xpAward: e.xpAward ?? 10,
      };
    }),
  };
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
  /** Legacy field: true only for a settled, fully-correct attempt. */
  isCorrect: boolean;
  /** Full verdict. `pending_review` means a human still has to grade it. */
  status: GradeStatus;
  /** 0..1. Meaningless while `status === 'pending_review'`. */
  score: number;
  /** False when a human produced (or still owes) the grade. */
  autoGraded: boolean;
  /** Learner-safe note from the engine. Never contains the answer. */
  feedback: string | null;
  /** Withheld until the attempt is settled, so an essay can't be peeked at. */
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

  // Resolve kind -> engine through the catalogue, then grade. `manual` kinds
  // come back `pending_review`: nothing is settled, so no XP and no heart lost
  // until a human grades it on /w/[slug]/grading.
  const resolver = await loadTypeResolver(ws.id, [ex.kind]);
  const type = resolver.get(ex.kind) ?? resolveExerciseType(ex.kind);
  const result: GradeResult =
    type.gradingMode === 'manual'
      ? { status: 'pending_review', score: 0, autoGraded: false }
      : gradeAnswer(type.engine, ex.payload, parsed.answer, { config: type.config });

  const isCorrect = result.status === 'correct';
  const isPending = result.status === 'pending_review';
  const isWrong = result.status === 'incorrect';

  // Server-side retry detection: prior attempts decide retry status, NOT the client.
  // (Client `isRetry` is advisory only — trusting it allowed full first-try XP forever.)
  const isServerRetry =
    (await countPriorAttempts(ws.id, user.id, ex.id)) > 0;

  // XP is awarded at most once per exercise (first correct attempt ever).
  // Re-submitting a correct answer awards nothing → no XP farming via replay.
  //
  // Scaled by `score`, which is 1 or 0 for every legacy kind — so the six
  // ported kinds pay exactly what they always paid. A `partial` result pays
  // proportionally; a `pending_review` one pays nothing until it is graded.
  let xpAwarded = 0;
  const earnsXp = !isPending && result.score > 0;
  if (earnsXp && !isServerRetry) {
    xpAwarded = Math.round((ex.xpAward ?? XP.EXERCISE_CORRECT_FIRST) * result.score);
    await db.insert(xpEvents).values({
      workspaceId: ws.id,
      userId: user.id,
      amount: xpAwarded,
      reason: 'exercise_correct',
      refKind: 'exercise',
      refId: ex.id,
    });
  } else if (earnsXp && isServerRetry) {
    // Retry-correct after at least one wrong attempt: small reward, once per exercise.
    if (!(await hasCorrectAttempt(ws.id, user.id, ex.id))) {
      xpAwarded = Math.round(XP.EXERCISE_CORRECT_RETRY * result.score);
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

  // Record attempt. `is_correct` stays in lockstep with `status` so the legacy
  // readers (computeLessonScore, hasCorrectAttempt) need no change.
  await db.insert(userExerciseAttempts).values({
    workspaceId: ws.id,
    userId: user.id,
    exerciseId: ex.id,
    answer: parsed.answer as Record<string, unknown>,
    isCorrect,
    status: result.status,
    score: String(result.score),
    timeTakenMs: parsed.timeTakenMs ?? null,
  });

  // Update hearts — single atomic upsert to avoid the read-modify-write race
  // where two concurrent wrong answers both read the same heart count and only
  // lose one heart.
  //
  // Only a settled WRONG answer costs a heart. An essay awaiting review has not
  // been judged yet, and a partial answer was not wrong — charging either would
  // punish the learner for the grader's latency.
  let heartsLeft = 5;
  if (isWrong) {
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
    after: {
      isCorrect,
      status: result.status,
      score: result.score,
      kind: ex.kind,
      engine: type.engine,
      xpAwarded,
      isRetry: isServerRetry,
    },
  });

  return {
    isCorrect,
    status: result.status,
    score: result.score,
    autoGraded: result.autoGraded,
    feedback: result.feedback ?? null,
    // Holding the explanation back while the attempt is unsettled stops a
    // learner from reading the model answer out of a pending essay.
    explanationMd: isPending ? null : ex.explanationMd ?? null,
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

/* ============================ manual grading (EDITOR+) ============================ */

/**
 * Read the pending-review queue for a workspace.
 *
 * EDITOR is the floor: grading decides someone's XP and progress, so it sits
 * with the people who own the content, not with every learner.
 */
export async function listGradingQueue(input: {
  workspaceSlug: string;
  limit?: number;
}): Promise<{ items: PendingAttempt[]; total: number }> {
  const parsed = z
    .object({
      workspaceSlug: z.string(),
      limit: z.number().int().min(1).max(200).optional(),
    })
    .parse(input);

  const { ws } = await resolveWorkspace(parsed.workspaceSlug, RBAC_LEVELS.EDITOR);
  const [items, total] = await Promise.all([
    listPendingAttempts(ws.id, parsed.limit ?? 50),
    countPendingAttempts(ws.id),
  ]);
  return { items, total };
}

const gradeInput = z
  .object({
    workspaceSlug: z.string(),
    attemptId: z.string().uuid(),
    /** Direct 0..1 score — essay and manual overrides. */
    score: z.number().min(0).max(1).optional(),
    /** Per-criterion 0..1 scores — rubric. The engine does the weighting. */
    rubricScores: z.record(z.number().min(0).max(1)).optional(),
    feedbackMd: z.string().max(10_000).optional(),
  })
  .refine((v) => v.score !== undefined || v.rubricScores !== undefined, {
    message: 'score or rubricScores is required',
  });

export type GradeSubmissionResult = {
  status: GradeStatus;
  score: number;
  xpAwarded: number;
};

/**
 * Settle one pending attempt: score it, notify the learner, audit the decision.
 *
 * The action itself only validates, resolves the workspace and delegates —
 * every rule (which engine, how a rubric totals, whether XP is owed) lives in
 * `@/lib/exercises/grading`.
 */
export async function gradeSubmission(
  input: z.infer<typeof gradeInput>,
): Promise<GradeSubmissionResult> {
  const parsed = gradeInput.parse(input);
  const { ws, user, ctx } = await resolveWorkspace(parsed.workspaceSlug, RBAC_LEVELS.EDITOR);

  const outcome = await gradeAttempt({
    workspaceId: ws.id,
    attemptId: parsed.attemptId,
    graderUserId: user.id,
    score: parsed.score,
    rubricScores: parsed.rubricScores,
    feedbackMd: parsed.feedbackMd,
  });

  // Tell the learner. A notification failure must not undo the grade.
  try {
    await db.insert(notifications).values({
      recipientUserId: outcome.learnerUserId,
      kind: 'attempt.graded',
      workspaceId: ws.id,
      resourceType: 'exercise',
      resourceId: outcome.exerciseId,
      title: 'Bài của bạn đã được chấm',
      body: parsed.feedbackMd
        ? parsed.feedbackMd.slice(0, 200)
        : `Kết quả: ${outcome.result.status} (${Math.round(outcome.result.score * 100)}%).`,
    });
  } catch (err) {
    console.error('[learn.gradeSubmission] notification failed:', err);
  }

  await db.insert(activityLog).values({
    workspaceId: ws.id,
    userId: outcome.learnerUserId,
    kind: 'attempt_graded',
    payload: {
      attemptId: outcome.attemptId,
      exerciseId: outcome.exerciseId,
      status: outcome.result.status,
      score: outcome.result.score,
    },
  });

  await writeAudit({
    workspaceId: ws.id,
    actorUserId: user.id,
    actorRole: ctx.role,
    action: 'attempt.grade',
    resourceType: 'exercise_attempt',
    resourceId: outcome.attemptId,
    before: outcome.before,
    after: {
      status: outcome.result.status,
      score: outcome.result.score,
      learnerUserId: outcome.learnerUserId,
      xpAwarded: outcome.xpAwarded,
      rubricScores: parsed.rubricScores ?? null,
    },
  });

  revalidatePath(`/w/${ws.slug}/grading`);
  revalidatePath(`/w/${ws.slug}`);

  return {
    status: outcome.result.status,
    score: outcome.result.score,
    xpAwarded: outcome.xpAwarded,
  };
}
