/**
 * `numeric_range` (new) — the answer is a number that must land inside an
 * accepted band.
 *
 * Two ways to express the band, either or both:
 *   - `target` + `tolerance`  → |answer - target| <= tolerance
 *   - `min` / `max`           → min <= answer <= max (either side optional)
 *
 * An optional wider `partialTolerance` band awards `partialScore` — "close
 * enough to show you understood the method, not close enough to be right".
 */
import { z } from 'zod';
import { clamp01, type GradeResult, type Grader } from '../types';

const numericPayload = z
  .object({
    target: z.number().optional(),
    tolerance: z.number().min(0).default(0),
    min: z.number().optional(),
    max: z.number().optional(),
    /** Wider band around `target` worth `partialScore`. */
    partialTolerance: z.number().min(0).optional(),
    partialScore: z.number().min(0).max(1).default(0.5),
    /** Display-only, safe to send to the client. */
    unit: z.string().optional(),
    decimals: z.number().int().min(0).max(10).optional(),
    hint: z.string().optional(),
  })
  .refine(
    (p) => p.target !== undefined || p.min !== undefined || p.max !== undefined,
    { message: 'numeric_range payload needs target or min/max' },
  );

/** Accept `12`, `"12"`, `" 12.5 "`, `"12,5"`. Anything else is NaN. */
function toNumber(answer: unknown): number {
  if (typeof answer === 'number') return answer;
  if (typeof answer !== 'string') return Number.NaN;
  const cleaned = answer.trim().replace(/\s+/g, '').replace(',', '.');
  if (cleaned === '') return Number.NaN;
  return Number(cleaned);
}

function inBand(
  v: number,
  p: { target?: number; tolerance: number; min?: number; max?: number },
  tolerance: number,
): boolean {
  if (p.target !== undefined && Math.abs(v - p.target) <= tolerance) return true;
  if (p.min !== undefined || p.max !== undefined) {
    const lo = p.min ?? Number.NEGATIVE_INFINITY;
    const hi = p.max ?? Number.POSITIVE_INFINITY;
    // The extra tolerance also widens an explicit min/max band.
    if (v >= lo - tolerance && v <= hi + tolerance) return true;
  }
  return false;
}

export const numericRangeGrader: Grader = {
  engine: 'numeric_range',
  mode: 'auto',
  // Everything that describes the accepted band is the answer.
  secretPaths: ['target', 'tolerance', 'min', 'max', 'partialTolerance', 'partialScore'],
  payloadSchema: numericPayload,
  answerSchema: z.union([z.number(), z.string()]),
  grade(payload, answer): GradeResult {
    const p = numericPayload.parse(payload);
    const v = toNumber(answer);

    if (!Number.isFinite(v)) {
      return {
        status: 'incorrect',
        score: 0,
        autoGraded: true,
        feedback: 'Đáp án phải là một con số.',
      };
    }

    if (inBand(v, p, p.tolerance)) {
      return { status: 'correct', score: 1, autoGraded: true };
    }

    if (p.partialTolerance !== undefined && inBand(v, p, p.partialTolerance)) {
      const score = clamp01(p.partialScore);
      return {
        status: score <= 0 ? 'incorrect' : 'partial',
        score,
        autoGraded: true,
        feedback: 'Gần đúng — sai số vẫn còn lớn hơn mức chấp nhận.',
      };
    }

    return {
      status: 'incorrect',
      score: 0,
      autoGraded: true,
      // Deliberately no numbers here: a "too high / too low" hint would let a
      // learner binary-search the answer in a handful of submissions.
      feedback: 'Giá trị nằm ngoài khoảng chấp nhận.',
    };
  },
};
