/**
 * Core contracts for the open exercise system.
 *
 * The old model was a closed `switch` returning `boolean`, which cannot express
 * "a human still has to read this" or "you got 3 of 4 rubric criteria". Every
 * grader now returns a `GradeResult`, and every grader is a registry entry
 * rather than a `case` label — so a new kind is data, not a code change.
 */
import type { z } from 'zod';

export type { GradingMode } from '@/lib/db/schema-exercises';

/**
 * Outcome of one attempt.
 *
 * - `correct` / `incorrect` — settled, full or zero credit.
 * - `partial` — settled, partial credit (`score` between 0 and 1 exclusive).
 * - `pending_review` — NOT settled; a human must grade it. `score` is 0 and
 *   carries no meaning until the grading screen writes a real one.
 */
export type GradeStatus = 'correct' | 'incorrect' | 'partial' | 'pending_review';

export type GradeResult = {
  status: GradeStatus;
  /** 0..1 inclusive. */
  score: number;
  /** False when a human produced (or still owes) the grade. */
  autoGraded: boolean;
  /** Learner-safe note. MUST NOT contain the expected answer. */
  feedback?: string;
};

/**
 * Extra input a grader may receive that does not come from the learner:
 * a human grader's decision, or per-type config from `exercise_types.config`.
 */
export type GradeContext = {
  /** Per-criterion scores supplied by a human (rubric engine). */
  rubricScores?: Record<string, number>;
  /** Direct 0..1 score supplied by a human (essay / any manual override). */
  manualScore?: number;
  /** Grader's note, echoed into the result. */
  feedback?: string;
  /** `exercise_types.config` for the resolved type. */
  config?: Record<string, unknown>;
};

/**
 * A grading engine.
 *
 * `secretPaths` is the generalisation of the old hardcoded `stripCorrect()`
 * switch: each engine declares which payload paths hold the answer, and
 * `sanitizePayload` removes exactly those before anything reaches a client.
 * Path syntax: `a.b` for nested objects, `a[].b` to map over an array.
 */
export type Grader = {
  /** Registry key. Matches `exercise_types.engine`. */
  engine: string;
  /** Default grading mode for types built on this engine. */
  mode: 'auto' | 'manual' | 'hybrid';
  /** Payload paths that must never be serialized to a client. */
  secretPaths: readonly string[];
  /** Shape of the authored payload. */
  payloadSchema: z.ZodTypeAny;
  /** Shape of a learner answer. */
  answerSchema: z.ZodTypeAny;
  /**
   * Grade one attempt. Throws (zod) when the authored payload is malformed —
   * an authoring bug must be loud, not silently marked wrong.
   */
  grade(payload: unknown, answer: unknown, ctx?: GradeContext): GradeResult;
};

/* ============================ small helpers ============================ */

/** Clamp any number into 0..1, mapping NaN to 0. */
export function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

/** Floating point slop for "is this score effectively 1 / 0?". */
const EPS = 1e-9;

/**
 * Map a 0..1 score to a settled status.
 *
 * `passThreshold` (default 1) is the score at or above which the attempt counts
 * as fully correct — a rubric can be "correct" at 0.8.
 */
export function statusForScore(score: number, passThreshold = 1): GradeStatus {
  const s = clamp01(score);
  if (s >= Math.min(1, passThreshold) - EPS) return 'correct';
  if (s <= EPS) return 'incorrect';
  return 'partial';
}

/** Settled all-or-nothing result — the shape every legacy grader returns. */
export function binary(ok: boolean): GradeResult {
  return { status: ok ? 'correct' : 'incorrect', score: ok ? 1 : 0, autoGraded: true };
}
