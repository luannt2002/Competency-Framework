/**
 * Grader registry — the replacement for the closed `switch`.
 *
 * An engine registers once at module load; everything else looks engines up by
 * key. Adding a kind that reuses an existing engine (essay with different
 * guidance, a rubric with other criteria, …) needs no code at all — it is a
 * row in `exercise_types`. Adding a genuinely new *algorithm* is one file plus
 * one `register()` call here, and nothing downstream changes.
 *
 * Pure module: no DB, no `next/*`, safe to import from unit tests.
 */
import type { GradeContext, GradeResult, Grader } from './types';
import { mcqGrader, mcqMultiGrader, codeBlockReviewGrader } from './graders/choice';
import { fillBlankGrader, typeAnswerGrader, shortAnswerGrader } from './graders/text';
import { orderStepsGrader } from './graders/order';
import { numericRangeGrader } from './graders/numeric';
import { essayGrader, rubricGrader } from './graders/manual';

const registry = new Map<string, Grader>();

/** Register (or replace) an engine. Later registrations win — last one loaded. */
export function registerGrader(grader: Grader): void {
  registry.set(grader.engine, grader);
}

/** Look up an engine. `undefined` when the key is unknown. */
export function getGrader(engine: string): Grader | undefined {
  return registry.get(engine);
}

/** Every registered engine key, sorted for stable output. */
export function listGraderEngines(): string[] {
  return [...registry.keys()].sort();
}

export function hasGrader(engine: string): boolean {
  return registry.has(engine);
}

/* ---- Built-in engines. Six ported from the old switch, four new. ---- */
for (const g of [
  mcqGrader,
  mcqMultiGrader,
  fillBlankGrader,
  orderStepsGrader,
  typeAnswerGrader,
  codeBlockReviewGrader,
  essayGrader,
  rubricGrader,
  numericRangeGrader,
  shortAnswerGrader,
]) {
  registerGrader(g);
}

export class UnknownEngineError extends Error {
  engine: string;
  constructor(engine: string) {
    super(`UNKNOWN_EXERCISE_ENGINE:${engine}`);
    this.name = 'UnknownEngineError';
    this.engine = engine;
  }
}

/**
 * Grade one answer.
 *
 * `engine` is the resolved engine key — for built-in kinds it equals the
 * exercise's `kind`; for a tenant kind it comes from `exercise_types.engine`.
 * Throws `UnknownEngineError` rather than silently marking the learner wrong,
 * because an unresolvable engine is an operator bug, not a wrong answer.
 */
export function gradeAnswer(
  engine: string,
  payload: unknown,
  answer: unknown,
  ctx?: GradeContext,
): GradeResult {
  const grader = registry.get(engine);
  if (!grader) throw new UnknownEngineError(engine);
  const merged: unknown =
    ctx?.config && payload && typeof payload === 'object'
      ? { ...ctx.config, ...(payload as Record<string, unknown>) }
      : payload;
  return grader.grade(merged, answer, ctx);
}

/** Grading mode of an engine, defaulting to `auto` for unknown keys. */
export function gradingModeFor(engine: string): 'auto' | 'manual' | 'hybrid' {
  return registry.get(engine)?.mode ?? 'auto';
}
