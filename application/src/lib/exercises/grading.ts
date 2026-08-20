/**
 * Manual grading domain — the queue behind /w/[slug]/grading.
 *
 * An attempt with `status = 'pending_review'` is unsettled: the learner has
 * submitted, nothing has been decided, no XP paid, no heart lost. A human with
 * EDITOR+ opens the queue, scores it, and `gradeAttempt` replays the SAME
 * engine that produced the pending result — a rubric total is computed by the
 * rubric engine, not by the UI. That keeps one grading algorithm, whether the
 * trigger is a learner submitting or a teacher deciding.
 *
 * Every query is workspace-scoped. Actions stay thin; the rules are here.
 */
import { and, asc, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import {
  exerciseAttempts,
  openExercises,
  type AttemptStatus,
} from '@/lib/db/schema-exercises';
import { lessons } from '@/lib/db/schema';
import { gradeAnswer } from './registry';
import { sanitizePayload } from './sanitize';
import { loadTypeResolver } from './type-repo';
import { resolveExerciseType } from './resolve';
import { insertXpOnce } from '@/lib/learn/xp-award';
import type { GradeResult } from './types';

export class GradingError extends Error {
  code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
    this.name = 'GradingError';
  }
}

/** One row of the pending queue, already stripped of answers-in-payload. */
export type PendingAttempt = {
  attemptId: string;
  exerciseId: string;
  lessonId: string;
  lessonTitle: string | null;
  userId: string;
  kind: string;
  typeLabel: string;
  engine: string;
  promptMd: string;
  /** Learner's submission — the thing being graded, so it is shown in full. */
  answer: unknown;
  /** Author payload MINUS every secret path (guidance survives, answers do not). */
  payload: unknown;
  /** Rubric criteria to score, empty for non-rubric kinds. */
  criteria: Array<{ id: string; label: string; weight: number }>;
  xpAward: number;
  submittedAt: string | null;
};

/**
 * The pending pile for a workspace, oldest first (fairest to the learner who
 * has waited longest). Backed by the partial index `uea_ws_pending_idx`.
 */
export async function listPendingAttempts(
  workspaceId: string,
  limit = 50,
): Promise<PendingAttempt[]> {
  const rows = await db
    .select({
      attemptId: exerciseAttempts.id,
      exerciseId: exerciseAttempts.exerciseId,
      userId: exerciseAttempts.userId,
      answer: exerciseAttempts.answer,
      createdAt: exerciseAttempts.createdAt,
      kind: openExercises.kind,
      promptMd: openExercises.promptMd,
      payload: openExercises.payload,
      xpAward: openExercises.xpAward,
      lessonId: openExercises.lessonId,
      lessonTitle: lessons.title,
    })
    .from(exerciseAttempts)
    .innerJoin(openExercises, eq(exerciseAttempts.exerciseId, openExercises.id))
    .leftJoin(lessons, eq(openExercises.lessonId, lessons.id))
    .where(
      and(
        eq(exerciseAttempts.workspaceId, workspaceId),
        eq(exerciseAttempts.status, 'pending_review'),
      ),
    )
    .orderBy(asc(exerciseAttempts.createdAt))
    .limit(limit);

  const resolver = await loadTypeResolver(
    workspaceId,
    rows.map((r) => r.kind),
  );

  return rows.map((r) => {
    const type = resolver.get(r.kind) ?? resolveExerciseType(r.kind);
    return {
      attemptId: r.attemptId,
      exerciseId: r.exerciseId,
      lessonId: r.lessonId,
      lessonTitle: r.lessonTitle ?? null,
      userId: r.userId,
      kind: r.kind,
      typeLabel: type.label,
      engine: type.engine,
      promptMd: r.promptMd,
      answer: r.answer,
      // A grader is a person too: the payload they see is sanitized the same
      // way the learner's is. Marking guidance lives in `criteria[].guidance`
      // — see below — not in the blob shipped to the browser.
      payload: sanitizePayload(r.payload, { secretPaths: type.secretPaths }),
      criteria: readCriteria(r.payload),
      xpAward: r.xpAward ?? 10,
      submittedAt: r.createdAt ? r.createdAt.toISOString() : null,
    };
  });
}

/** Criterion list (id/label/weight only) pulled out of a rubric payload. */
function readCriteria(payload: unknown): Array<{ id: string; label: string; weight: number }> {
  if (!payload || typeof payload !== 'object') return [];
  const raw = (payload as { criteria?: unknown }).criteria;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((c): c is Record<string, unknown> => !!c && typeof c === 'object')
    .map((c) => ({
      id: String(c.id ?? ''),
      label: String(c.label ?? ''),
      weight: typeof c.weight === 'number' && c.weight > 0 ? c.weight : 1,
    }))
    .filter((c) => c.id !== '');
}

export type GradeAttemptInput = {
  workspaceId: string;
  attemptId: string;
  graderUserId: string;
  /** Direct 0..1 score. Used by essay / any manual override. */
  score?: number;
  /** Per-criterion 0..1 scores. Used by rubric; the engine does the weighting. */
  rubricScores?: Record<string, number>;
  feedbackMd?: string;
};

export type GradeAttemptOutcome = {
  attemptId: string;
  exerciseId: string;
  learnerUserId: string;
  lessonId: string;
  before: { status: string | null; score: string | null };
  result: GradeResult;
  xpAwarded: number;
};

/**
 * Settle one pending attempt.
 *
 * The engine is re-run with the grader's decision in `GradeContext`, so the
 * status/score mapping (pass thresholds, partial credit) is identical to the
 * automatic path. XP is proportional to the score and paid at most once per
 * (workspace, user, exercise) via `insertXpOnce`, so re-grading a submission —
 * a teacher fixing a typo'd score — never pays twice.
 */
export async function gradeAttempt(input: GradeAttemptInput): Promise<GradeAttemptOutcome> {
  if (input.score === undefined && input.rubricScores === undefined) {
    throw new GradingError('NO_SCORE_SUPPLIED');
  }

  const rows = await db
    .select({
      attemptId: exerciseAttempts.id,
      exerciseId: exerciseAttempts.exerciseId,
      userId: exerciseAttempts.userId,
      answer: exerciseAttempts.answer,
      status: exerciseAttempts.status,
      score: exerciseAttempts.score,
      kind: openExercises.kind,
      payload: openExercises.payload,
      xpAward: openExercises.xpAward,
      lessonId: openExercises.lessonId,
    })
    .from(exerciseAttempts)
    .innerJoin(openExercises, eq(exerciseAttempts.exerciseId, openExercises.id))
    // Tenant scope on BOTH sides: attempt and exercise must belong to this ws.
    .where(
      and(
        eq(exerciseAttempts.id, input.attemptId),
        eq(exerciseAttempts.workspaceId, input.workspaceId),
        eq(openExercises.workspaceId, input.workspaceId),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) throw new GradingError('ATTEMPT_NOT_FOUND');

  const resolver = await loadTypeResolver(input.workspaceId, [row.kind]);
  const type = resolver.get(row.kind) ?? resolveExerciseType(row.kind);

  const result = gradeAnswer(type.engine, row.payload, row.answer, {
    manualScore: input.score,
    rubricScores: input.rubricScores,
    feedback: input.feedbackMd,
    config: type.config,
  });

  if (result.status === 'pending_review') {
    // The engine refused to settle (e.g. rubric with no scores at all).
    throw new GradingError('ENGINE_STILL_PENDING');
  }

  await db
    .update(exerciseAttempts)
    .set({
      status: result.status,
      score: String(result.score),
      // Kept in lockstep so computeLessonScore / hasCorrectAttempt, which
      // still read the boolean, see graded work.
      isCorrect: result.status === 'correct',
      feedbackMd: input.feedbackMd ?? null,
      gradedBy: input.graderUserId,
      gradedAt: new Date(),
      rubric: input.rubricScores ?? null,
    })
    .where(
      and(
        eq(exerciseAttempts.id, input.attemptId),
        eq(exerciseAttempts.workspaceId, input.workspaceId),
      ),
    );

  let xpAwarded = 0;
  const payable = Math.round((row.xpAward ?? 10) * result.score);
  if (payable > 0) {
    const inserted = await insertXpOnce({
      workspaceId: input.workspaceId,
      userId: row.userId,
      amount: payable,
      reason: 'exercise_correct',
      refKind: 'exercise',
      refId: row.exerciseId,
    });
    if (inserted) xpAwarded = payable;
  }

  return {
    attemptId: row.attemptId,
    exerciseId: row.exerciseId,
    learnerUserId: row.userId,
    lessonId: row.lessonId,
    before: { status: row.status, score: row.score },
    result,
    xpAwarded,
  };
}

/** Size of the pending queue — cheap count for badges/headers. */
export async function countPendingAttempts(workspaceId: string): Promise<number> {
  const rows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(exerciseAttempts)
    .where(
      and(
        eq(exerciseAttempts.workspaceId, workspaceId),
        eq(exerciseAttempts.status, 'pending_review'),
      ),
    );
  return rows[0]?.n ?? 0;
}

/** Narrowing helper for callers holding a raw string from the DB. */
export function isAttemptStatus(value: string | null): value is AttemptStatus {
  return (
    value === 'correct' ||
    value === 'incorrect' ||
    value === 'partial' ||
    value === 'pending_review'
  );
}
