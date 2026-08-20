/**
 * Server-side exercise evaluator — thin compatibility shim.
 *
 * The real logic moved to the grader registry in `src/lib/exercises/`, which
 * returns a `GradeResult` (correct / incorrect / partial / pending_review +
 * a 0..1 score) instead of a boolean. A boolean cannot express "an essay is
 * waiting for a human" or "3 of 4 rubric criteria passed", which is exactly
 * why the old closed `switch` had to go.
 *
 * This file stays so existing callers and tests keep compiling. New code
 * should import `gradeAnswer` from '@/lib/exercises/registry' and branch on
 * `status`, not on a boolean.
 *
 * @deprecated Use `gradeAnswer` from '@/lib/exercises/registry'.
 */
import { gradeAnswer } from '@/lib/exercises/registry';

/**
 * The six kinds that existed while `exercises.kind` was a Postgres enum.
 * The column is now `text` and the set is open (see `exercise_types`), so this
 * union is history, not a constraint.
 *
 * @deprecated The kind set is open; use `string`.
 */
export type ExerciseKind =
  | 'mcq'
  | 'mcq_multi'
  | 'fill_blank'
  | 'order_steps'
  | 'type_answer'
  | 'code_block_review';

/**
 * Legacy boolean verdict.
 *
 * Only `status === 'correct'` counts as true, so partial credit reads as false
 * and a pending essay reads as false — the same conservative answer the old
 * switch would have given if it could have represented them at all.
 *
 * @deprecated Use `gradeAnswer` and read `status` / `score`.
 */
export function evaluateExercise(
  kind: ExerciseKind | string,
  payload: unknown,
  answer: unknown,
): boolean {
  return gradeAnswer(kind, payload, answer).status === 'correct';
}
