/**
 * Text-family graders.
 *
 * `fill_blank` and `type_answer` are ported verbatim from the original
 * evaluator switch (all-or-nothing, same defaults for `matchKind`).
 *
 * `short_answer` is new: same accept-list matching, but it can also award
 * PARTIAL credit from a weighted keyword list — the thing `type_answer` could
 * never express because its return type was a boolean.
 */
import { z } from 'zod';
import { matchOne, normalizeLoose } from '../match';
import { binary, clamp01, statusForScore, type GradeResult, type Grader } from '../types';

const matchKind = z.enum(['exact', 'exact_ci', 'regex']);

/* ============================ fill_blank ============================ */

const fillPayload = z.object({
  template: z.string(),
  blanks: z.array(
    z.object({
      id: z.number(),
      accepts: z.array(z.string()),
      matchKind: matchKind.default('exact_ci'),
    }),
  ),
});

export const fillBlankGrader: Grader = {
  engine: 'fill_blank',
  mode: 'auto',
  // Only the accept lists are secret; `matchKind` stays so the client can hint
  // at the expected input style (this is what the original comment intended).
  secretPaths: ['blanks[].accepts'],
  payloadSchema: fillPayload,
  answerSchema: z.record(z.string()),
  grade(payload, answer) {
    const p = fillPayload.parse(payload);
    if (typeof answer !== 'object' || answer === null) return binary(false);
    const obj = answer as Record<string, string>;
    for (const b of p.blanks) {
      const val = obj[String(b.id)] ?? '';
      if (!matchOne(val, b.accepts, b.matchKind)) return binary(false);
    }
    return binary(true);
  },
};

/* ============================ type_answer ============================ */

const typePayload = z.object({
  accepts: z.array(z.string()),
  matchKind: matchKind.default('regex'),
  hint: z.string().optional(),
});

export const typeAnswerGrader: Grader = {
  engine: 'type_answer',
  mode: 'auto',
  secretPaths: ['accepts'],
  payloadSchema: typePayload,
  answerSchema: z.string(),
  grade(payload, answer) {
    const p = typePayload.parse(payload);
    return binary(typeof answer === 'string' && matchOne(answer, p.accepts, p.matchKind));
  },
};

/* ============================ short_answer (new) ============================ */

const shortAnswerPayload = z.object({
  /** Full-credit forms. An empty list means "score from keywords only". */
  accepts: z.array(z.string()).default([]),
  matchKind: matchKind.default('exact_ci'),
  /** Weighted concepts the answer should mention. Drives partial credit. */
  keywords: z
    .array(
      z.object({
        text: z.string().min(1),
        weight: z.number().positive().default(1),
      }),
    )
    .default([]),
  /** Keyword coverage at or above this counts as fully correct. */
  passThreshold: z.number().min(0).max(1).default(1),
  /** Shown to the learner before answering — never contains the answer. */
  hint: z.string().optional(),
  maxChars: z.number().int().positive().optional(),
});

export const shortAnswerGrader: Grader = {
  engine: 'short_answer',
  mode: 'auto',
  // `accepts`, `keywords` and the bar to clear all leak the answer.
  secretPaths: ['accepts', 'keywords', 'passThreshold'],
  payloadSchema: shortAnswerPayload,
  answerSchema: z.string(),
  grade(payload, answer): GradeResult {
    const p = shortAnswerPayload.parse(payload);
    if (typeof answer !== 'string' || answer.trim() === '') {
      return { status: 'incorrect', score: 0, autoGraded: true };
    }

    // An exact/regex hit short-circuits to full credit.
    if (p.accepts.length > 0 && matchOne(answer, p.accepts, p.matchKind)) {
      return binary(true);
    }

    if (p.keywords.length === 0) {
      return { status: 'incorrect', score: 0, autoGraded: true };
    }

    const haystack = normalizeLoose(answer);
    const totalWeight = p.keywords.reduce((sum, k) => sum + k.weight, 0);
    const hitWeight = p.keywords.reduce(
      (sum, k) => (haystack.includes(normalizeLoose(k.text)) ? sum + k.weight : sum),
      0,
    );
    const score = clamp01(totalWeight === 0 ? 0 : hitWeight / totalWeight);
    const hits = p.keywords.filter((k) => haystack.includes(normalizeLoose(k.text))).length;

    return {
      status: statusForScore(score, p.passThreshold),
      score,
      autoGraded: true,
      // Counts only — naming the missing keywords would hand over the answer.
      feedback: `Nhắc tới ${hits}/${p.keywords.length} ý chính.`,
    };
  },
};
