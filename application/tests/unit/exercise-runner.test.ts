/**
 * Lesson-runner domain.
 *
 * These are the rules the UI would otherwise have re-implemented per widget:
 * which widget a kind gets, when an answer may be submitted, what shape goes
 * on the wire, and how an attempt history collapses into one verdict.
 *
 * Two properties matter more than the rest and are asserted head-on:
 *
 *   1. Every payload here is what `sanitizePayload` produces — i.e. the answer
 *      keys are already gone. The spec builder must still produce a working
 *      widget from that. A builder that needed `correctId` would be a leak.
 *   2. A tenant kind on a known engine renders like the built-in; a tenant kind
 *      on an UNKNOWN engine falls back to its declared answer schema, and only
 *      then to free text. That chain is the product promise of open kinds.
 */
import { describe, it, expect } from 'vitest';
import {
  buildRunnerSpec,
  draftToAnswer,
  emptyDraft,
  foldAttempts,
  isDraftReady,
  mayRevealExplanation,
  moveInOrder,
  readCode,
  readCriteria,
  readGuidance,
  shuffleWithSeed,
  summarizeLesson,
  verdictTone,
  type AnswerDraft,
} from '@/lib/exercises/runner';
import { sanitizePayload } from '@/lib/exercises/sanitize';
import { getGrader } from '@/lib/exercises/registry';
import { resolveExerciseType } from '@/lib/exercises/resolve';

/** Sanitize a payload exactly as `startLesson` would before it reaches a client. */
function asShipped(engine: string, payload: unknown): unknown {
  return sanitizePayload(payload, { secretPaths: getGrader(engine)?.secretPaths ?? [] });
}

const EMPTY_SPEC = { fields: [] };

describe('buildRunnerSpec — engine to widget', () => {
  it('maps mcq to a single-choice widget from a payload with correctId already stripped', () => {
    const payload = asShipped('mcq', {
      options: [
        { id: 'a', text: 'A' },
        { id: 'b', text: 'B' },
      ],
      correctId: 'b',
    });
    expect(JSON.stringify(payload)).not.toContain('correctId');

    const spec = buildRunnerSpec({ engine: 'mcq', payload, answerSpec: EMPTY_SPEC });
    expect(spec.input).toBe('single');
    if (spec.input !== 'single') throw new Error('unreachable');
    expect(spec.options.map((o) => o.id)).toEqual(['a', 'b']);
  });

  it('maps mcq_multi to multi and order_steps to order', () => {
    const multi = buildRunnerSpec({
      engine: 'mcq_multi',
      payload: asShipped('mcq_multi', {
        options: [{ id: 'a', text: 'A' }],
        correctIds: ['a'],
      }),
      answerSpec: EMPTY_SPEC,
    });
    expect(multi.input).toBe('multi');

    const order = buildRunnerSpec({
      engine: 'order_steps',
      payload: asShipped('order_steps', {
        steps: [
          { id: '1', text: 'one' },
          { id: '2', text: 'two' },
        ],
        correctOrder: ['1', '2'],
      }),
      answerSpec: EMPTY_SPEC,
    });
    expect(order.input).toBe('order');
    if (order.input !== 'order') throw new Error('unreachable');
    expect(order.steps).toHaveLength(2);
  });

  it('keeps fill_blank usable after `accepts` is stripped, and preserves matchKind', () => {
    const payload = asShipped('fill_blank', {
      template: 'Tối đa ___ giờ.',
      blanks: [{ id: 1, accepts: ['12'], matchKind: 'exact_ci' }],
    });
    expect(JSON.stringify(payload)).not.toContain('accepts');

    const spec = buildRunnerSpec({ engine: 'fill_blank', payload, answerSpec: EMPTY_SPEC });
    expect(spec.input).toBe('blanks');
    if (spec.input !== 'blanks') throw new Error('unreachable');
    expect(spec.blanks).toEqual([{ id: '1', matchKind: 'exact_ci' }]);
  });

  it('gives type_answer one line and essay/short_answer/rubric a box', () => {
    const single = buildRunnerSpec({
      engine: 'type_answer',
      payload: asShipped('type_answer', { accepts: ['^x$'], matchKind: 'regex', hint: 'x…' }),
      answerSpec: EMPTY_SPEC,
    });
    expect(single).toMatchObject({ input: 'text', multiline: false });

    for (const engine of ['essay', 'short_answer', 'rubric']) {
      const spec = buildRunnerSpec({ engine, payload: {}, answerSpec: EMPTY_SPEC });
      expect(spec).toMatchObject({ input: 'text', multiline: true });
    }
  });

  it('carries essay word guidance through to the widget', () => {
    const spec = buildRunnerSpec({
      engine: 'essay',
      payload: asShipped('essay', {
        minWords: 120,
        maxWords: 400,
        guidanceMd: 'Nêu 3 rủi ro.',
        modelAnswerMd: 'ĐÁP ÁN MẪU',
      }),
      answerSpec: EMPTY_SPEC,
    });
    expect(spec).toMatchObject({ input: 'text', minWords: 120, maxWords: 400 });
  });

  it('maps numeric_range to a number box carrying only display metadata', () => {
    const payload = asShipped('numeric_range', {
      target: 42,
      tolerance: 1,
      unit: 'giây',
      decimals: 1,
    });
    // The band IS the answer — none of it may survive.
    expect(JSON.stringify(payload)).not.toContain('target');
    const spec = buildRunnerSpec({ engine: 'numeric_range', payload, answerSpec: EMPTY_SPEC });
    expect(spec).toEqual({ input: 'number', unit: 'giây', decimals: 1 });
  });
});

describe('buildRunnerSpec — open kinds', () => {
  it('renders a tenant kind on a known engine exactly like the built-in', () => {
    // `interview_screen` is a slug no code has heard of, built on `mcq`.
    const type = resolveExerciseType('interview_screen', {
      slug: 'interview_screen',
      label: 'Sàng lọc phỏng vấn',
      engine: 'mcq',
      gradingMode: 'auto',
      secretFields: null,
      isBuiltin: false,
    });
    expect(type.engine).toBe('mcq');

    const spec = buildRunnerSpec({
      engine: type.engine,
      payload: asShipped('mcq', {
        options: [{ id: 'a', text: 'A' }],
        correctId: 'a',
      }),
      answerSpec: type.answerSpec,
    });
    expect(spec.input).toBe('single');
  });

  it('falls back to the declared answer schema when the engine has no widget', () => {
    const spec = buildRunnerSpec({
      engine: 'some_future_engine',
      payload: {},
      answerSpec: {
        fields: [
          { key: 'repoUrl', label: 'Link repo', type: 'string', required: true, secret: false },
          { key: 'notes', label: 'Ghi chú', type: 'markdown', required: false, secret: false },
        ],
      },
    });
    expect(spec.input).toBe('fields');
    if (spec.input !== 'fields') throw new Error('unreachable');
    expect(spec.fields.map((f) => f.key)).toEqual(['repoUrl', 'notes']);
  });

  it('never renders an answer field the tenant flagged secret', () => {
    const type = resolveExerciseType('secretive', {
      slug: 'secretive',
      label: 'Có field bí mật',
      engine: 'unknown_engine',
      gradingMode: 'manual',
      secretFields: null,
      answerSchema: {
        fields: [
          { key: 'visible', label: 'Thấy được', type: 'string', required: false, secret: false },
          { key: 'hidden', label: 'Bí mật', type: 'string', required: false, secret: true },
        ],
      },
      isBuiltin: false,
    });
    expect(type.answerSpec.fields.map((f) => f.key)).toEqual(['visible']);

    const spec = buildRunnerSpec({
      engine: type.engine,
      payload: {},
      answerSpec: type.answerSpec,
    });
    if (spec.input !== 'fields') throw new Error('unreachable');
    expect(spec.fields.map((f) => f.key)).toEqual(['visible']);
  });

  it('falls back to free text when there is neither a widget nor a schema', () => {
    const spec = buildRunnerSpec({ engine: 'nothing_known', payload: {}, answerSpec: EMPTY_SPEC });
    expect(spec).toMatchObject({ input: 'text', multiline: true });
  });

  it('degrades a half-authored mcq instead of rendering an unanswerable radio group', () => {
    const spec = buildRunnerSpec({
      engine: 'mcq',
      payload: { options: [] },
      answerSpec: EMPTY_SPEC,
    });
    expect(spec.input).toBe('text');
  });
});

describe('draft lifecycle', () => {
  const mcqSpec = buildRunnerSpec({
    engine: 'mcq',
    payload: {
      options: [
        { id: 'a', text: 'A' },
        { id: 'b', text: 'B' },
      ],
    },
    answerSpec: EMPTY_SPEC,
  });

  it('blocks submission until a choice is made', () => {
    const draft = emptyDraft(mcqSpec);
    expect(isDraftReady(mcqSpec, draft)).toBe(false);
    expect(isDraftReady(mcqSpec, { input: 'single', value: 'b' })).toBe(true);
    expect(draftToAnswer(mcqSpec, { input: 'single', value: 'b' })).toBe('b');
  });

  it('requires every blank to be filled, and submits them keyed by blank id', () => {
    const spec = buildRunnerSpec({
      engine: 'fill_blank',
      payload: {
        template: 'a ___ b ___',
        blanks: [
          { id: 1, matchKind: 'exact_ci' },
          { id: 2, matchKind: 'exact_ci' },
        ],
      },
      answerSpec: EMPTY_SPEC,
    });
    const partial: AnswerDraft = { input: 'blanks', values: { '1': '12' } };
    expect(isDraftReady(spec, partial)).toBe(false);

    const full: AnswerDraft = { input: 'blanks', values: { '1': '12', '2': 'x' } };
    expect(isDraftReady(spec, full)).toBe(true);
    expect(draftToAnswer(spec, full)).toEqual({ '1': '12', '2': 'x' });
  });

  it('starts an ordering draft in authored order and reorders without losing steps', () => {
    const spec = buildRunnerSpec({
      engine: 'order_steps',
      payload: {
        steps: [
          { id: '1', text: 'one' },
          { id: '2', text: 'two' },
          { id: '3', text: 'three' },
        ],
      },
      answerSpec: EMPTY_SPEC,
    });
    const draft = emptyDraft(spec);
    expect(draft).toEqual({ input: 'order', ids: ['1', '2', '3'] });

    expect(moveInOrder(['1', '2', '3'], 2, 0)).toEqual(['3', '1', '2']);
    // Clamped at the ends rather than dropping the item off the list.
    expect(moveInOrder(['1', '2', '3'], 0, -1)).toEqual(['1', '2', '3']);
    expect(moveInOrder(['1', '2', '3'], 2, 9)).toEqual(['1', '2', '3']);
  });

  it('treats whitespace as an empty text answer', () => {
    const spec = buildRunnerSpec({ engine: 'essay', payload: {}, answerSpec: EMPTY_SPEC });
    expect(isDraftReady(spec, { input: 'text', value: '   \n ' })).toBe(false);
    expect(isDraftReady(spec, { input: 'text', value: 'Có nội dung' })).toBe(true);
  });

  it('accepts a comma decimal, the way the numeric grader does', () => {
    const spec = buildRunnerSpec({ engine: 'numeric_range', payload: {}, answerSpec: EMPTY_SPEC });
    expect(isDraftReady(spec, { input: 'number', value: '12,5' })).toBe(true);
    expect(isDraftReady(spec, { input: 'number', value: 'mười hai' })).toBe(false);
    // Handed over as typed so the stored attempt records what was written.
    expect(draftToAnswer(spec, { input: 'number', value: ' 12,5 ' })).toBe('12,5');
  });

  it('coerces schema fields by declared type and drops empties', () => {
    const spec = buildRunnerSpec({
      engine: 'unknown',
      payload: {},
      answerSpec: {
        fields: [
          { key: 'name', label: 'Tên', type: 'string', required: true, secret: false },
          { key: 'count', label: 'Số', type: 'number', required: false, secret: false },
          { key: 'flag', label: 'Cờ', type: 'boolean', required: false, secret: false },
          { key: 'items', label: 'Danh sách', type: 'string_list', required: false, secret: false },
          { key: 'blob', label: 'JSON', type: 'json', required: false, secret: false },
          { key: 'skip', label: 'Bỏ trống', type: 'string', required: false, secret: false },
        ],
      },
    });

    const draft: AnswerDraft = {
      input: 'fields',
      values: {
        name: 'Luân',
        count: '3,5',
        flag: 'true',
        items: 'a\nb\n\n',
        blob: '{"k":1}',
        skip: '   ',
      },
    };
    expect(isDraftReady(spec, draft)).toBe(true);
    expect(draftToAnswer(spec, draft)).toEqual({
      name: 'Luân',
      count: 3.5,
      flag: true,
      items: ['a', 'b'],
      blob: { k: 1 },
    });
  });

  it('requires only the fields marked required', () => {
    const spec = buildRunnerSpec({
      engine: 'unknown',
      payload: {},
      answerSpec: {
        fields: [
          { key: 'must', label: 'Bắt buộc', type: 'string', required: true, secret: false },
          { key: 'may', label: 'Tuỳ chọn', type: 'string', required: false, secret: false },
        ],
      },
    });
    expect(isDraftReady(spec, { input: 'fields', values: { may: 'x' } })).toBe(false);
    expect(isDraftReady(spec, { input: 'fields', values: { must: 'x' } })).toBe(true);
  });
});

describe('option shuffling', () => {
  it('is stable for a given seed and keeps every option', () => {
    const options = ['a', 'b', 'c', 'd', 'e'];
    const once = shuffleWithSeed(options, 'exercise-1');
    const twice = shuffleWithSeed(options, 'exercise-1');
    expect(once).toEqual(twice);
    expect([...once].sort()).toEqual([...options].sort());
  });

  it('differs between exercises so a lesson is not one repeated permutation', () => {
    const options = ['a', 'b', 'c', 'd', 'e', 'f'];
    expect(shuffleWithSeed(options, 'ex-1')).not.toEqual(shuffleWithSeed(options, 'ex-2'));
  });

  it('only shuffles when the payload asks for it', () => {
    const options = [
      { id: 'a', text: 'A' },
      { id: 'b', text: 'B' },
      { id: 'c', text: 'C' },
      { id: 'd', text: 'D' },
    ];
    const stable = buildRunnerSpec({
      engine: 'mcq',
      payload: { options },
      answerSpec: EMPTY_SPEC,
      seed: 'seed',
    });
    if (stable.input !== 'single') throw new Error('unreachable');
    expect(stable.options.map((o) => o.id)).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('payload readers', () => {
  it('reads a code listing and its language', () => {
    expect(readCode({ code: 'x = 1', language: 'python' })).toEqual({
      code: 'x = 1',
      language: 'python',
    });
    expect(readCode({ code: 'x = 1' })).toEqual({ code: 'x = 1', language: 'text' });
    expect(readCode({})).toBeNull();
  });

  it('shows rubric criteria to the learner but never the marking guidance', () => {
    const payload = asShipped('rubric', {
      criteria: [
        { id: 'c1', label: 'Đúng khái niệm', weight: 2, guidance: 'CHO ĐIỂM KHI…' },
        { id: 'c2', label: 'Ví dụ thực tế', weight: 1, guidance: 'BÍ MẬT' },
      ],
      passThreshold: 0.8,
      guidanceMd: 'Viết 200 từ.',
      modelAnswerMd: 'ĐÁP ÁN MẪU',
    });
    expect(JSON.stringify(payload)).not.toContain('CHO ĐIỂM KHI');
    expect(JSON.stringify(payload)).not.toContain('ĐÁP ÁN MẪU');
    // The bar to clear is part of the answer too.
    expect(JSON.stringify(payload)).not.toContain('passThreshold');

    expect(readCriteria(payload)).toEqual([
      { id: 'c1', label: 'Đúng khái niệm', weight: 2 },
      { id: 'c2', label: 'Ví dụ thực tế', weight: 1 },
    ]);
    expect(readGuidance(payload)).toBe('Viết 200 từ.');
  });
});

describe('attempt folding', () => {
  const base = {
    feedbackMd: null,
    gradedAt: null,
  };

  it('reports nothing for an exercise never attempted', () => {
    expect(foldAttempts([]).size).toBe(0);
  });

  it('follows the latest attempt but keeps a correct answer earned', () => {
    const folded = foldAttempts([
      {
        exerciseId: 'e1',
        status: 'incorrect',
        score: '0',
        isCorrect: false,
        createdAt: '2026-01-01T10:00:00Z',
        ...base,
      },
      {
        exerciseId: 'e1',
        status: 'correct',
        score: '1',
        isCorrect: true,
        createdAt: '2026-01-01T10:05:00Z',
        ...base,
      },
      {
        exerciseId: 'e1',
        status: 'incorrect',
        score: '0',
        isCorrect: false,
        createdAt: '2026-01-01T10:09:00Z',
        ...base,
      },
    ]);
    const e1 = folded.get('e1');
    expect(e1?.status).toBe('incorrect');
    expect(e1?.attemptCount).toBe(3);
    // XP was already paid once; the screen must not claim it was lost.
    expect(e1?.everCorrect).toBe(true);
    expect(e1?.bestScore).toBe(1);
  });

  it('marks a pending attempt as awaiting review, then clears it once graded', () => {
    const pending = foldAttempts([
      {
        exerciseId: 'e2',
        status: 'pending_review',
        score: '0',
        isCorrect: false,
        createdAt: '2026-01-01T10:00:00Z',
        ...base,
      },
    ]).get('e2');
    expect(pending?.awaitingReview).toBe(true);
    expect(pending?.status).toBe('pending_review');

    // Grading UPDATES the same row rather than inserting a new one.
    const graded = foldAttempts([
      {
        exerciseId: 'e2',
        status: 'partial',
        score: '0.75',
        isCorrect: false,
        feedbackMd: 'Thiếu ví dụ.',
        gradedAt: '2026-01-02T09:00:00Z',
        createdAt: '2026-01-01T10:00:00Z',
      },
    ]).get('e2');
    expect(graded?.awaitingReview).toBe(false);
    expect(graded?.score).toBe(0.75);
    expect(graded?.feedbackMd).toBe('Thiếu ví dụ.');
    expect(graded?.gradedAt).toBe('2026-01-02T09:00:00.000Z');
  });

  it('clamps a stored score that drifted outside 0..1', () => {
    const out = foldAttempts([
      {
        exerciseId: 'e3',
        status: 'correct',
        score: '1.4',
        isCorrect: true,
        createdAt: '2026-01-01T10:00:00Z',
        ...base,
      },
    ]).get('e3');
    expect(out?.score).toBe(1);
  });
});

describe('lesson summary', () => {
  it('counts answered, settled, awaiting and scores like computeLessonScore', () => {
    const outcomes = foldAttempts([
      {
        exerciseId: 'a',
        status: 'correct',
        score: '1',
        isCorrect: true,
        createdAt: '2026-01-01T10:00:00Z',
        feedbackMd: null,
        gradedAt: null,
      },
      {
        exerciseId: 'b',
        status: 'pending_review',
        score: '0',
        isCorrect: false,
        createdAt: '2026-01-01T10:01:00Z',
        feedbackMd: null,
        gradedAt: null,
      },
      {
        exerciseId: 'c',
        status: 'incorrect',
        score: '0',
        isCorrect: false,
        createdAt: '2026-01-01T10:02:00Z',
        feedbackMd: null,
        gradedAt: null,
      },
    ]);

    const s = summarizeLesson(['a', 'b', 'c', 'd'], outcomes);
    expect(s).toEqual({
      total: 4,
      answered: 3,
      settled: 2,
      correct: 1,
      awaitingReview: 1,
      scorePct: 0.25,
      allAnswered: false,
    });
  });

  it('lets a lesson finish while an essay is still in the queue', () => {
    const outcomes = foldAttempts([
      {
        exerciseId: 'a',
        status: 'correct',
        score: '1',
        isCorrect: true,
        createdAt: '2026-01-01T10:00:00Z',
        feedbackMd: null,
        gradedAt: null,
      },
      {
        exerciseId: 'b',
        status: 'pending_review',
        score: '0',
        isCorrect: false,
        createdAt: '2026-01-01T10:01:00Z',
        feedbackMd: null,
        gradedAt: null,
      },
    ]);
    const s = summarizeLesson(['a', 'b'], outcomes);
    expect(s.allAnswered).toBe(true);
    expect(s.awaitingReview).toBe(1);
    expect(s.scorePct).toBe(0.5);
  });

  it('is zero, not NaN, for a lesson with no exercises', () => {
    expect(summarizeLesson([], new Map()).scorePct).toBe(0);
  });
});

describe('verdict presentation', () => {
  it('gives pending_review its own tone rather than folding it into wrong', () => {
    expect(verdictTone('pending_review')).toBe('pending');
    expect(verdictTone('incorrect')).toBe('incorrect');
    expect(verdictTone('partial')).toBe('partial');
    expect(verdictTone('correct')).toBe('correct');
    expect(verdictTone(null)).toBeNull();
  });

  it('withholds the explanation until the attempt is settled', () => {
    expect(mayRevealExplanation('pending_review')).toBe(false);
    expect(mayRevealExplanation(null)).toBe(false);
    expect(mayRevealExplanation('incorrect')).toBe(true);
    expect(mayRevealExplanation('correct')).toBe(true);
  });
});
