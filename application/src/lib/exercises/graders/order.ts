/**
 * `order_steps` — drag the steps into the right sequence.
 *
 * Ported verbatim from the original evaluator switch: all-or-nothing, a length
 * mismatch is wrong, and a non-array answer is wrong rather than a throw.
 */
import { z } from 'zod';
import { binary, type Grader } from '../types';

const orderPayload = z.object({
  steps: z.array(z.object({ id: z.string(), text: z.string() })),
  correctOrder: z.array(z.string()),
});

export const orderStepsGrader: Grader = {
  engine: 'order_steps',
  mode: 'auto',
  secretPaths: ['correctOrder'],
  payloadSchema: orderPayload,
  answerSchema: z.array(z.string()),
  grade(payload, answer) {
    const p = orderPayload.parse(payload);
    if (!Array.isArray(answer) || answer.length !== p.correctOrder.length) {
      return binary(false);
    }
    return binary(
      answer.every((id, i) => typeof id === 'string' && id === p.correctOrder[i]),
    );
  },
};
