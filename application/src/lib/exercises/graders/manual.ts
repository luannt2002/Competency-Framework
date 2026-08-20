/**
 * Human-in-the-loop graders — the reason `GradeResult` exists.
 *
 * `essay`  — free-form writing. Submitting NEVER settles it: the attempt lands
 *            in `pending_review` and waits for /w/[slug]/grading.
 * `rubric` — weighted criteria. The engine can do arithmetic but not judgement,
 *            so it stays `pending_review` until a human supplies per-criterion
 *            scores, then it computes the weighted total.
 */
import { z } from 'zod';
import { clamp01, statusForScore, type GradeResult, type Grader } from '../types';

/* ============================ essay ============================ */

const essayPayload = z.object({
  minWords: z.number().int().min(0).optional(),
  maxWords: z.number().int().min(1).optional(),
  /** Instructions shown to the learner. */
  guidanceMd: z.string().optional(),
  /** Reference answer — graders only. */
  modelAnswerMd: z.string().optional(),
  /** Marking notes — graders only. */
  graderNotesMd: z.string().optional(),
});

function countWords(text: string): number {
  const t = text.trim();
  return t === '' ? 0 : t.split(/\s+/).length;
}

/** Waiting-for-a-human result. Score carries no meaning until graded. */
function pending(feedback?: string): GradeResult {
  return { status: 'pending_review', score: 0, autoGraded: false, feedback };
}

export const essayGrader: Grader = {
  engine: 'essay',
  mode: 'manual',
  secretPaths: ['modelAnswerMd', 'graderNotesMd'],
  payloadSchema: essayPayload,
  answerSchema: z.string(),
  grade(payload, answer, ctx): GradeResult {
    const p = essayPayload.parse(payload);

    // A human already decided (grading screen replays through the same engine).
    if (ctx?.manualScore !== undefined) {
      const score = clamp01(ctx.manualScore);
      return {
        status: statusForScore(score),
        score,
        autoGraded: false,
        feedback: ctx.feedback,
      };
    }

    const text = typeof answer === 'string' ? answer : '';
    const words = countWords(text);
    // Length is surfaced as a note for the grader; it never auto-fails the
    // learner — that judgement belongs to a person.
    if (p.minWords !== undefined && words < p.minWords) {
      return pending(`Bài viết ${words} từ, ngắn hơn mức gợi ý ${p.minWords} từ.`);
    }
    if (p.maxWords !== undefined && words > p.maxWords) {
      return pending(`Bài viết ${words} từ, dài hơn mức gợi ý ${p.maxWords} từ.`);
    }
    return pending();
  },
};

/* ============================ rubric ============================ */

const rubricPayload = z.object({
  criteria: z
    .array(
      z.object({
        id: z.string().min(1),
        label: z.string().min(1),
        weight: z.number().positive().default(1),
        /** What "full marks" means — grader-facing. */
        guidance: z.string().optional(),
      }),
    )
    .min(1),
  /** Weighted total at or above this counts as fully correct. */
  passThreshold: z.number().min(0).max(1).default(0.8),
  guidanceMd: z.string().optional(),
  modelAnswerMd: z.string().optional(),
});

export type RubricCriterion = z.infer<typeof rubricPayload>['criteria'][number];

/**
 * Weighted mean of per-criterion scores.
 *
 * Pure and exported so the grading UI can preview a total without a round trip,
 * and so tests can assert the arithmetic directly. Criteria missing from
 * `scores` count as 0 — a half-filled rubric must not inflate the total.
 */
export function weightedRubricScore(
  criteria: ReadonlyArray<{ id: string; weight: number }>,
  scores: Record<string, number>,
): number {
  const totalWeight = criteria.reduce((sum, c) => sum + c.weight, 0);
  if (totalWeight === 0) return 0;
  const earned = criteria.reduce(
    (sum, c) => sum + c.weight * clamp01(scores[c.id] ?? 0),
    0,
  );
  return clamp01(earned / totalWeight);
}

export const rubricGrader: Grader = {
  engine: 'rubric',
  mode: 'hybrid',
  secretPaths: ['criteria[].guidance', 'modelAnswerMd', 'passThreshold'],
  payloadSchema: rubricPayload,
  answerSchema: z.union([z.string(), z.record(z.unknown())]),
  grade(payload, _answer, ctx): GradeResult {
    const p = rubricPayload.parse(payload);

    // No human scores yet → queue it. Learner-supplied scores are ignored by
    // construction: `ctx` is assembled server-side by the grading action only.
    if (!ctx?.rubricScores) {
      if (ctx?.manualScore !== undefined) {
        const score = clamp01(ctx.manualScore);
        return {
          status: statusForScore(score, p.passThreshold),
          score,
          autoGraded: false,
          feedback: ctx.feedback,
        };
      }
      return pending();
    }

    const score = weightedRubricScore(p.criteria, ctx.rubricScores);
    return {
      status: statusForScore(score, p.passThreshold),
      score,
      autoGraded: false,
      feedback: ctx.feedback,
    };
  },
};
