/**
 * Server-side exercise evaluator. NEVER trust the client.
 * Returns { isCorrect } for each kind.
 */
import { z } from 'zod';

export type ExerciseKind =
  | 'mcq'
  | 'mcq_multi'
  | 'fill_blank'
  | 'order_steps'
  | 'type_answer'
  | 'code_block_review';

const mcqPayload = z.object({
  options: z.array(z.object({ id: z.string(), text: z.string() })),
  correctId: z.string(),
  shuffle: z.boolean().optional(),
});
const mcqMultiPayload = z.object({
  options: z.array(z.object({ id: z.string(), text: z.string() })),
  correctIds: z.array(z.string()),
  shuffle: z.boolean().optional(),
});
const fillPayload = z.object({
  template: z.string(),
  blanks: z.array(
    z.object({
      id: z.number(),
      accepts: z.array(z.string()),
      matchKind: z.enum(['exact', 'exact_ci', 'regex']).default('exact_ci'),
    }),
  ),
});
const orderPayload = z.object({
  steps: z.array(z.object({ id: z.string(), text: z.string() })),
  correctOrder: z.array(z.string()),
});
const typePayload = z.object({
  accepts: z.array(z.string()),
  matchKind: z.enum(['exact', 'exact_ci', 'regex']).default('regex'),
  hint: z.string().optional(),
});
const codeReviewPayload = z.object({
  code: z.string(),
  language: z.string().optional(),
  question: z.string(),
  options: z.array(z.object({ id: z.string(), text: z.string() })),
  correctId: z.string(),
});

export function evaluateExercise(
  kind: ExerciseKind,
  payload: unknown,
  answer: unknown,
): boolean {
  switch (kind) {
    case 'mcq': {
      const p = mcqPayload.parse(payload);
      return typeof answer === 'string' && answer === p.correctId;
    }
    case 'mcq_multi': {
      const p = mcqMultiPayload.parse(payload);
      if (!Array.isArray(answer)) return false;
      const a = new Set(answer.filter((x): x is string => typeof x === 'string'));
      const c = new Set(p.correctIds);
      if (a.size !== c.size) return false;
      for (const id of a) if (!c.has(id)) return false;
      return true;
    }
    case 'fill_blank': {
      const p = fillPayload.parse(payload);
      if (typeof answer !== 'object' || answer === null) return false;
      const obj = answer as Record<string, string>;
      for (const b of p.blanks) {
        const val = obj[String(b.id)] ?? '';
        if (!matchOne(val, b.accepts, b.matchKind)) return false;
      }
      return true;
    }
    case 'order_steps': {
      const p = orderPayload.parse(payload);
      if (!Array.isArray(answer) || answer.length !== p.correctOrder.length) return false;
      return answer.every(
        (id, i) => typeof id === 'string' && id === p.correctOrder[i],
      );
    }
    case 'type_answer': {
      const p = typePayload.parse(payload);
      return typeof answer === 'string' && matchOne(answer, p.accepts, p.matchKind);
    }
    case 'code_block_review': {
      const p = codeReviewPayload.parse(payload);
      return typeof answer === 'string' && answer === p.correctId;
    }
  }
}

function matchOne(value: string, accepts: string[], kind: 'exact' | 'exact_ci' | 'regex'): boolean {
  const v = value.trim();
  for (const a of accepts) {
    if (kind === 'exact' && v === a) return true;
    if (kind === 'exact_ci' && v.toLowerCase() === a.toLowerCase()) return true;
    if (kind === 'regex') {
      try {
        if (new RegExp(a).test(v)) return true;
      } catch {
        // bad regex in seed → skip
      }
    }
  }
  return false;
}
