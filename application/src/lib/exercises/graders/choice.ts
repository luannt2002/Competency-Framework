/**
 * Choice-family graders: `mcq`, `mcq_multi`, `code_block_review`.
 *
 * Ported one-for-one from the original `switch` in
 * src/lib/learn/exercise-evaluator.ts — same zod payload shapes, same
 * comparisons, same "malformed answer counts as wrong" behaviour. Only the
 * return type changed (boolean -> GradeResult).
 */
import { z } from 'zod';
import { binary, type Grader } from '../types';

const option = z.object({ id: z.string(), text: z.string() });

const mcqPayload = z.object({
  options: z.array(option),
  correctId: z.string(),
  shuffle: z.boolean().optional(),
});

const mcqMultiPayload = z.object({
  options: z.array(option),
  correctIds: z.array(z.string()),
  shuffle: z.boolean().optional(),
});

const codeReviewPayload = z.object({
  code: z.string(),
  language: z.string().optional(),
  question: z.string(),
  options: z.array(option),
  correctId: z.string(),
});

export const mcqGrader: Grader = {
  engine: 'mcq',
  mode: 'auto',
  secretPaths: ['correctId'],
  payloadSchema: mcqPayload,
  answerSchema: z.string(),
  grade(payload, answer) {
    const p = mcqPayload.parse(payload);
    return binary(typeof answer === 'string' && answer === p.correctId);
  },
};

export const mcqMultiGrader: Grader = {
  engine: 'mcq_multi',
  mode: 'auto',
  secretPaths: ['correctIds'],
  payloadSchema: mcqMultiPayload,
  answerSchema: z.array(z.string()),
  grade(payload, answer) {
    const p = mcqMultiPayload.parse(payload);
    if (!Array.isArray(answer)) return binary(false);
    const a = new Set(answer.filter((x): x is string => typeof x === 'string'));
    const c = new Set(p.correctIds);
    if (a.size !== c.size) return binary(false);
    for (const id of a) if (!c.has(id)) return binary(false);
    return binary(true);
  },
};

export const codeBlockReviewGrader: Grader = {
  engine: 'code_block_review',
  mode: 'auto',
  secretPaths: ['correctId'],
  payloadSchema: codeReviewPayload,
  answerSchema: z.string(),
  grade(payload, answer) {
    const p = codeReviewPayload.parse(payload);
    return binary(typeof answer === 'string' && answer === p.correctId);
  },
};
