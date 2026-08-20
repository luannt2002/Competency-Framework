/**
 * Attempt history reads for the lesson runner.
 *
 * The runner is not a one-shot form: a learner opens a lesson, answers three
 * of five exercises, leaves, and comes back tomorrow — possibly after a
 * teacher has graded the essay they submitted. This module is what makes the
 * screen honest on that second visit.
 *
 * Every query is workspace- AND user-scoped: an attempt belongs to exactly one
 * learner and reading someone else's answers is not a feature.
 *
 * The folding rules live in `./runner` (pure, unit-tested); this file only
 * fetches rows.
 */
import { and, asc, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { exerciseAttempts, openExercises } from '@/lib/db/schema-exercises';
import {
  foldAttempts,
  mayRevealExplanation,
  summarizeLesson,
  type ExerciseOutcome,
  type LessonProgress,
} from './runner';

export type { ExerciseOutcome, LessonProgress };

/**
 * Outcome per exercise for one learner, keyed by exercise id.
 *
 * Exercises with no attempt are simply absent from the map — callers treat a
 * miss as "not started", which is what an absent row means.
 */
export async function loadExerciseOutcomes(params: {
  workspaceId: string;
  userId: string;
  exerciseIds: string[];
}): Promise<Map<string, ExerciseOutcome>> {
  if (params.exerciseIds.length === 0) return new Map();

  const rows = await db
    .select({
      exerciseId: exerciseAttempts.exerciseId,
      status: exerciseAttempts.status,
      score: exerciseAttempts.score,
      isCorrect: exerciseAttempts.isCorrect,
      feedbackMd: exerciseAttempts.feedbackMd,
      gradedAt: exerciseAttempts.gradedAt,
      createdAt: exerciseAttempts.createdAt,
    })
    .from(exerciseAttempts)
    .where(
      and(
        eq(exerciseAttempts.workspaceId, params.workspaceId),
        eq(exerciseAttempts.userId, params.userId),
        inArray(exerciseAttempts.exerciseId, params.exerciseIds),
      ),
    )
    // Oldest first so the fold's "latest wins" comparison is a simple sweep.
    .orderBy(asc(exerciseAttempts.createdAt));

  return foldAttempts(rows);
}

/**
 * One learner's standing in one lesson: how many answered, correct, waiting.
 *
 * The summary any surface OUTSIDE the runner needs — the node page teaser, a
 * progress chip — without loading payloads or building specs. Returns a
 * zero-total summary for a lesson with no exercises, so callers never branch
 * on null.
 */
export async function loadLessonProgress(params: {
  workspaceId: string;
  userId: string;
  lessonId: string;
}): Promise<LessonProgress> {
  const rows = await db
    .select({ id: openExercises.id })
    .from(openExercises)
    .where(
      and(
        eq(openExercises.workspaceId, params.workspaceId),
        eq(openExercises.lessonId, params.lessonId),
      ),
    );

  const exerciseIds = rows.map((r) => r.id);
  const outcomes = await loadExerciseOutcomes({
    workspaceId: params.workspaceId,
    userId: params.userId,
    exerciseIds,
  });
  return summarizeLesson(exerciseIds, outcomes);
}

/**
 * Explanations the learner has EARNED the right to read.
 *
 * `explanation_md` is authored feedback that frequently restates the answer,
 * so it is released per exercise only once that learner's latest attempt is
 * settled. An essay sitting in the grading queue returns nothing — the same
 * rule `submitExercise` enforces on the wire, applied again on the read path
 * so a page refresh cannot become the peek-hole the submit path refuses.
 */
export async function loadSettledExplanations(params: {
  workspaceId: string;
  lessonId: string;
  outcomes: ReadonlyMap<string, ExerciseOutcome>;
}): Promise<Map<string, string>> {
  const eligible = [...params.outcomes.values()]
    .filter((o) => mayRevealExplanation(o.status))
    .map((o) => o.exerciseId);
  if (eligible.length === 0) return new Map();

  const rows = await db
    .select({ id: openExercises.id, explanationMd: openExercises.explanationMd })
    .from(openExercises)
    .where(
      and(
        eq(openExercises.workspaceId, params.workspaceId),
        eq(openExercises.lessonId, params.lessonId),
        inArray(openExercises.id, eligible),
      ),
    );

  const out = new Map<string, string>();
  for (const r of rows) {
    if (r.explanationMd) out.set(r.id, r.explanationMd);
  }
  return out;
}
