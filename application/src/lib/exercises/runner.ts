/**
 * Lesson-runner domain — PURE.
 *
 * The lesson runner has to answer three questions for every exercise it shows,
 * and none of them belong in a React component:
 *
 *   1. "What widget does the learner type into?"  -> `buildRunnerSpec`
 *   2. "Is this answer complete enough to send?"  -> `isDraftReady`
 *   3. "What shape does `submitExercise` want?"   -> `draftToAnswer`
 *
 * The dispatch key is the ENGINE, never the kind. A tenant that invents the
 * kind `interview_screen` on top of the `mcq` engine gets the radio-button
 * renderer for free; a tenant that invents a kind on an engine this file has
 * never heard of falls back to the declarative `answer_schema` field spec, and
 * only then to a plain textarea. That fallback chain is the whole reason the
 * open exercise system is worth having, so it is tested rather than assumed.
 *
 * Everything here is fed by a payload that already went through
 * `sanitizePayload`, i.e. the answer keys are GONE. A spec builder that needed
 * `correctId` to render would be a leak by construction; none of them do.
 *
 * No DB, no React, no `next/*` — safe to import from a unit test.
 */
import type { FieldDescriptor, FieldSpec, FieldType } from './field-spec';
import type { GradeStatus } from './types';
import { clamp01 } from './types';

/* ============================ interaction spec ============================ */

export type ChoiceOption = { id: string; text: string };

/** One `___` slot of a fill-in-the-blank template. */
export type BlankSlot = { id: string; matchKind: string };

/**
 * How the learner enters an answer. Deliberately smaller than the engine set:
 * `mcq` and `code_block_review` are both "pick one", and the difference —
 * a code listing above the question — is display, handled by the readers below.
 */
export type RunnerInput =
  | 'single'
  | 'multi'
  | 'order'
  | 'blanks'
  | 'text'
  | 'number'
  | 'fields';

export type RunnerSpec =
  | { input: 'single'; options: ChoiceOption[] }
  | { input: 'multi'; options: ChoiceOption[] }
  | { input: 'order'; steps: ChoiceOption[] }
  | { input: 'blanks'; template: string; blanks: BlankSlot[] }
  | {
      input: 'text';
      multiline: boolean;
      minWords: number | null;
      maxWords: number | null;
      maxChars: number | null;
    }
  | { input: 'number'; unit: string | null; decimals: number | null }
  | { input: 'fields'; fields: FieldDescriptor[] };

/** Engine -> widget. Unlisted engines resolve through the fallback chain. */
const ENGINE_INPUT: Record<string, RunnerInput> = {
  mcq: 'single',
  code_block_review: 'single',
  mcq_multi: 'multi',
  order_steps: 'order',
  fill_blank: 'blanks',
  type_answer: 'text',
  short_answer: 'text',
  essay: 'text',
  rubric: 'text',
  numeric_range: 'number',
};

/** `type_answer` is one line; every other text engine wants room to write. */
const SINGLE_LINE_ENGINES = new Set(['type_answer']);

/* ---------------------------- payload readers ---------------------------- */

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readOptions(payload: unknown, key: string): ChoiceOption[] {
  const raw = asRecord(payload)[key];
  if (!Array.isArray(raw)) return [];
  return raw
    .map((o) => asRecord(o))
    .map((o) => ({ id: String(o.id ?? ''), text: String(o.text ?? '') }))
    .filter((o) => o.id !== '');
}

function readNumber(payload: unknown, key: string): number | null {
  const raw = asRecord(payload)[key];
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : null;
}

function readText(payload: unknown, key: string): string | null {
  const raw = asRecord(payload)[key];
  return typeof raw === 'string' && raw.length > 0 ? raw : null;
}

/** Learner-facing hint. Never an answer: `accepts`/`keywords` are stripped. */
export function readHint(payload: unknown): string | null {
  return readText(payload, 'hint');
}

/** Author instructions for a written answer (essay / rubric). */
export function readGuidance(payload: unknown): string | null {
  return readText(payload, 'guidanceMd');
}

/** Code listing + language for the `code_block_review` engine. */
export function readCode(payload: unknown): { code: string; language: string } | null {
  const code = readText(payload, 'code');
  if (code === null) return null;
  return { code, language: readText(payload, 'language') ?? 'text' };
}

/** Extra question line shown under a code listing. */
export function readQuestion(payload: unknown): string | null {
  return readText(payload, 'question');
}

/**
 * Rubric criteria the learner is allowed to see.
 *
 * `criteria[].guidance` is a secret path, so what survives sanitisation is the
 * label and the weight — exactly the "here is what you are marked on" summary
 * a learner should have BEFORE writing, and nothing that gives the answer away.
 */
export function readCriteria(
  payload: unknown,
): Array<{ id: string; label: string; weight: number }> {
  const raw = asRecord(payload).criteria;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((c) => asRecord(c))
    .map((c) => ({
      id: String(c.id ?? ''),
      label: String(c.label ?? ''),
      weight: typeof c.weight === 'number' && c.weight > 0 ? c.weight : 1,
    }))
    .filter((c) => c.id !== '');
}

/* ---------------------------- deterministic shuffle ---------------------------- */

/** FNV-1a — small, dependency-free, good enough to seed a shuffle. */
function hashSeed(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Fisher-Yates driven by a seeded PRNG.
 *
 * Seeded, not random: the option order must survive a re-render and a page
 * reload, otherwise "the third one" moves under the learner's cursor mid-click
 * and a returning learner sees a different quiz than the one they left.
 */
export function shuffleWithSeed<T>(items: readonly T[], seed: string): T[] {
  const out = [...items];
  let state = hashSeed(seed) || 1;
  for (let i = out.length - 1; i > 0; i -= 1) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    const j = state % (i + 1);
    const a = out[i] as T;
    const b = out[j] as T;
    out[i] = b;
    out[j] = a;
  }
  return out;
}

/* ---------------------------- spec builder ---------------------------- */

export type BuildSpecInput = {
  /** Resolved engine key — NOT the kind. */
  engine: string;
  /** Payload as it left `sanitizePayload`. */
  payload: unknown;
  /** `exercise_types.answer_schema`, public fields only. */
  answerSpec?: FieldSpec | null;
  /** Stable per-exercise seed for option shuffling (use the exercise id). */
  seed?: string;
};

const TEXT_FALLBACK: RunnerSpec = {
  input: 'text',
  multiline: true,
  minWords: null,
  maxWords: null,
  maxChars: null,
};

/**
 * Decide the widget for one exercise.
 *
 * Fallback chain, in order:
 *   1. the engine's own widget, when the payload actually carries what it needs
 *   2. the tenant's declarative `answer_schema` (generic field renderer)
 *   3. a free-text box
 *
 * Step 1 checks the payload rather than trusting the engine name, so a
 * half-authored `mcq` with zero options degrades to something usable instead
 * of rendering an empty radio group the learner can never satisfy.
 */
export function buildRunnerSpec(input: BuildSpecInput): RunnerSpec {
  const { engine, payload, seed } = input;
  const fields = (input.answerSpec?.fields ?? []).filter((f) => !f.secret);
  const fallback: RunnerSpec =
    fields.length > 0 ? { input: 'fields', fields } : TEXT_FALLBACK;

  const shuffleWanted = asRecord(payload).shuffle === true;
  const arrange = (options: ChoiceOption[]): ChoiceOption[] =>
    shuffleWanted && seed ? shuffleWithSeed(options, seed) : options;

  switch (ENGINE_INPUT[engine]) {
    case 'single': {
      const options = readOptions(payload, 'options');
      return options.length > 0 ? { input: 'single', options: arrange(options) } : fallback;
    }
    case 'multi': {
      const options = readOptions(payload, 'options');
      return options.length > 0 ? { input: 'multi', options: arrange(options) } : fallback;
    }
    case 'order': {
      const steps = readOptions(payload, 'steps');
      return steps.length > 0 ? { input: 'order', steps } : fallback;
    }
    case 'blanks': {
      const template = readText(payload, 'template');
      const raw = asRecord(payload).blanks;
      const blanks = Array.isArray(raw)
        ? raw
            .map((b) => asRecord(b))
            .map((b) => ({
              id: String(b.id ?? ''),
              matchKind: String(b.matchKind ?? 'exact_ci'),
            }))
            .filter((b) => b.id !== '')
        : [];
      return template !== null && blanks.length > 0
        ? { input: 'blanks', template, blanks }
        : fallback;
    }
    case 'number':
      return {
        input: 'number',
        unit: readText(payload, 'unit'),
        decimals: readNumber(payload, 'decimals'),
      };
    case 'text':
      return {
        input: 'text',
        multiline: !SINGLE_LINE_ENGINES.has(engine),
        minWords: readNumber(payload, 'minWords'),
        maxWords: readNumber(payload, 'maxWords'),
        maxChars: readNumber(payload, 'maxChars'),
      };
    default:
      return fallback;
  }
}

/* ============================ answer draft ============================ */

/**
 * In-progress answer, one variant per widget.
 *
 * Everything a form control produces is a string, so the draft stores strings
 * and `draftToAnswer` does the single, testable coercion into whatever the
 * grader's `answerSchema` expects.
 */
export type AnswerDraft =
  | { input: 'single'; value: string | null }
  | { input: 'multi'; values: string[] }
  | { input: 'order'; ids: string[] }
  | { input: 'blanks'; values: Record<string, string> }
  | { input: 'text'; value: string }
  | { input: 'number'; value: string }
  | { input: 'fields'; values: Record<string, string> };

export function emptyDraft(spec: RunnerSpec): AnswerDraft {
  switch (spec.input) {
    case 'single':
      return { input: 'single', value: null };
    case 'multi':
      return { input: 'multi', values: [] };
    case 'order':
      // Starts in the authored order. The authored order is NOT the answer:
      // `correctOrder` is a secret path and never reaches this module.
      return { input: 'order', ids: spec.steps.map((s) => s.id) };
    case 'blanks':
      return { input: 'blanks', values: {} };
    case 'text':
      return { input: 'text', value: '' };
    case 'number':
      return { input: 'number', value: '' };
    case 'fields':
      return { input: 'fields', values: {} };
  }
}

/** Count words the way the essay grader does, so the UI hint cannot disagree. */
export function countWords(text: string): number {
  const t = text.trim();
  return t === '' ? 0 : t.split(/\s+/).length;
}

/**
 * Can this draft be submitted?
 *
 * This is a completeness gate, never a correctness one — it must not encode
 * anything about the expected answer. Word counts are advisory for essays
 * (the grader treats them as notes, not failures), so a short essay is still
 * submittable.
 */
export function isDraftReady(spec: RunnerSpec, draft: AnswerDraft): boolean {
  if (spec.input !== draft.input) return false;
  switch (draft.input) {
    case 'single':
      return draft.value !== null && draft.value !== '';
    case 'multi':
      return draft.values.length > 0;
    case 'order':
      return spec.input === 'order' && draft.ids.length === spec.steps.length;
    case 'blanks':
      return (
        spec.input === 'blanks' &&
        spec.blanks.every((b) => (draft.values[b.id] ?? '').trim() !== '')
      );
    case 'text':
      return draft.value.trim() !== '';
    case 'number':
      return draft.value.trim() !== '' && Number.isFinite(parseLooseNumber(draft.value));
    case 'fields':
      return (
        spec.input === 'fields' &&
        spec.fields
          .filter((f) => f.required)
          .every((f) => (draft.values[f.key] ?? '').trim() !== '')
      );
  }
}

/** Mirrors the numeric grader's tolerance for `" 12,5 "`. */
function parseLooseNumber(raw: string): number {
  const cleaned = raw.trim().replace(/\s+/g, '').replace(',', '.');
  return cleaned === '' ? Number.NaN : Number(cleaned);
}

function coerceField(type: FieldType, raw: string): unknown {
  const value = raw.trim();
  switch (type) {
    case 'number': {
      const n = parseLooseNumber(value);
      return Number.isFinite(n) ? n : undefined;
    }
    case 'boolean':
      return value === 'true';
    case 'string_list':
    case 'option_list':
      return value
        .split('\n')
        .map((s) => s.trim())
        .filter((s) => s !== '');
    case 'json':
      try {
        return JSON.parse(value) as unknown;
      } catch {
        // A tenant typed prose into a json field. Send it through as text
        // rather than dropping the learner's work on the floor — the grader's
        // zod schema is what decides whether it is acceptable.
        return raw;
      }
    default:
      return raw;
  }
}

/**
 * Turn a draft into the value `submitExercise` posts.
 *
 * The shapes here are the graders' `answerSchema`s, not an invention of this
 * file: string for mcq, string[] for mcq_multi/order_steps, Record<string,
 * string> keyed by blank id for fill_blank, string for every text engine
 * (numeric_range parses strings itself), object for a schema-driven kind.
 */
export function draftToAnswer(spec: RunnerSpec, draft: AnswerDraft): unknown {
  switch (draft.input) {
    case 'single':
      return draft.value ?? '';
    case 'multi':
      return [...draft.values];
    case 'order':
      return [...draft.ids];
    case 'blanks':
      return spec.input === 'blanks'
        ? Object.fromEntries(spec.blanks.map((b) => [b.id, draft.values[b.id] ?? '']))
        : { ...draft.values };
    case 'text':
      return draft.value;
    case 'number':
      // Handed over as typed. The grader normalises "12,5" itself, and keeping
      // the raw string means the attempt row records what the learner wrote.
      return draft.value.trim();
    case 'fields': {
      if (spec.input !== 'fields') return { ...draft.values };
      const out: Record<string, unknown> = {};
      for (const f of spec.fields) {
        const raw = draft.values[f.key];
        if (raw === undefined || raw.trim() === '') continue;
        const coerced = coerceField(f.type, raw);
        if (coerced !== undefined) out[f.key] = coerced;
      }
      return out;
    }
  }
}

/** Move one item of an ordering draft. Returns a new draft; clamps at the ends. */
export function moveInOrder(ids: readonly string[], from: number, to: number): string[] {
  if (from < 0 || from >= ids.length) return [...ids];
  const target = Math.min(Math.max(to, 0), ids.length - 1);
  if (target === from) return [...ids];
  const next = [...ids];
  const [moved] = next.splice(from, 1);
  if (moved === undefined) return [...ids];
  next.splice(target, 0, moved);
  return next;
}

/* ============================ attempt history ============================ */

/** Minimal projection of a `user_exercise_attempts` row. */
export type AttemptRowLike = {
  exerciseId: string;
  status: string | null;
  score: string | number | null;
  isCorrect: boolean | null;
  feedbackMd: string | null;
  gradedAt: Date | string | null;
  createdAt: Date | string | null;
};

/** What the runner knows about one exercise before the learner touches it. */
export type ExerciseOutcome = {
  exerciseId: string;
  /** Status of the LATEST attempt. Null when never attempted. */
  status: GradeStatus | null;
  /** Score of the latest attempt, 0..1. */
  score: number;
  attemptCount: number;
  /** Ever settled correct — this is what `computeLessonScore` counts. */
  everCorrect: boolean;
  bestScore: number;
  /** Grader's note, present once a human has settled a manual attempt. */
  feedbackMd: string | null;
  gradedAt: string | null;
  submittedAt: string | null;
  /** Submitted, nothing decided yet: show "đang chờ chấm", never a verdict. */
  awaitingReview: boolean;
};

function toStatus(raw: string | null): GradeStatus | null {
  return raw === 'correct' || raw === 'incorrect' || raw === 'partial' || raw === 'pending_review'
    ? raw
    : null;
}

function toIso(value: Date | string | null): string | null {
  if (value === null) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function toScore(value: string | number | null): number {
  if (value === null) return 0;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? clamp01(n) : 0;
}

function timeOf(value: Date | string | null): number {
  if (value === null) return 0;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

/**
 * Collapse an attempt history into one outcome per exercise.
 *
 * `status` follows the LATEST attempt because grading updates that row in
 * place — a graded essay stops being pending the moment a teacher scores it.
 * `everCorrect` is separate and monotonic, so a learner who gets it right then
 * experiments with a wrong answer does not lose credit they already earned
 * (XP is likewise paid at most once, in `submitExercise`).
 */
export function foldAttempts(rows: readonly AttemptRowLike[]): Map<string, ExerciseOutcome> {
  const out = new Map<string, ExerciseOutcome>();
  for (const row of rows) {
    const prev = out.get(row.exerciseId);
    const score = toScore(row.score);
    const status = toStatus(row.status);
    const isNewer = prev === undefined || timeOf(row.createdAt) >= timeOf(prev.submittedAt);

    const latest = isNewer
      ? {
          status,
          score,
          feedbackMd: row.feedbackMd,
          gradedAt: toIso(row.gradedAt),
          submittedAt: toIso(row.createdAt),
          awaitingReview: status === 'pending_review',
        }
      : {
          status: prev.status,
          score: prev.score,
          feedbackMd: prev.feedbackMd,
          gradedAt: prev.gradedAt,
          submittedAt: prev.submittedAt,
          awaitingReview: prev.awaitingReview,
        };

    out.set(row.exerciseId, {
      exerciseId: row.exerciseId,
      ...latest,
      attemptCount: (prev?.attemptCount ?? 0) + 1,
      everCorrect: (prev?.everCorrect ?? false) || row.isCorrect === true || status === 'correct',
      bestScore: Math.max(prev?.bestScore ?? 0, score),
    });
  }
  return out;
}

/* ============================ lesson summary ============================ */

export type LessonProgress = {
  total: number;
  /** Exercises with at least one attempt. */
  answered: number;
  /** Exercises whose latest attempt is settled (not awaiting a human). */
  settled: number;
  /** Exercises ever answered correctly — the numerator of `scorePct`. */
  correct: number;
  awaitingReview: number;
  /** 0..1, computed exactly as `computeLessonScore` does on the server. */
  scorePct: number;
  /** True when every exercise has been attempted at least once. */
  allAnswered: boolean;
};

/**
 * Roll a lesson up for the progress bar and the "finish lesson" gate.
 *
 * `scorePct` mirrors `computeLessonScore` (distinct-correct / total) on
 * purpose: the client must never show a number the server would recompute
 * differently, and `completeLesson` recomputes it server-side anyway.
 */
export function summarizeLesson(
  exerciseIds: readonly string[],
  outcomes: ReadonlyMap<string, ExerciseOutcome>,
): LessonProgress {
  const total = exerciseIds.length;
  let answered = 0;
  let settled = 0;
  let correct = 0;
  let awaitingReview = 0;

  for (const id of exerciseIds) {
    const o = outcomes.get(id);
    if (!o || o.attemptCount === 0) continue;
    answered += 1;
    if (o.awaitingReview) awaitingReview += 1;
    else settled += 1;
    if (o.everCorrect) correct += 1;
  }

  return {
    total,
    answered,
    settled,
    correct,
    awaitingReview,
    scorePct: total === 0 ? 0 : Math.min(1, correct / total),
    allAnswered: total > 0 && answered === total,
  };
}

/* ============================ verdict presentation ============================ */

/**
 * Tone of a settled (or unsettled) verdict.
 *
 * `pending` is its own tone and MUST NOT collapse into `incorrect`: an essay
 * awaiting review has not been judged, and colouring it red would tell the
 * learner something untrue about work nobody has read yet.
 */
export type VerdictTone = 'correct' | 'partial' | 'incorrect' | 'pending';

export function verdictTone(status: GradeStatus | null): VerdictTone | null {
  switch (status) {
    case 'correct':
      return 'correct';
    case 'partial':
      return 'partial';
    case 'incorrect':
      return 'incorrect';
    case 'pending_review':
      return 'pending';
    default:
      return null;
  }
}

/**
 * May the learner see the model explanation yet?
 *
 * Only for a settled attempt. While an essay sits in the queue the explanation
 * is withheld — the same rule `submitExercise` applies server-side, restated
 * here so a component cannot accidentally render one it was handed.
 */
export function mayRevealExplanation(status: GradeStatus | null): boolean {
  return status !== null && status !== 'pending_review';
}
