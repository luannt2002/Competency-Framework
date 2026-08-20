/**
 * Grader registry + the four new engines.
 *
 * The six ported engines keep their own coverage in exercise-evaluator.test.ts
 * (unchanged, still green through the compatibility shim). What is asserted
 * here is the part the old boolean API could not express: pending review,
 * partial credit, weighted rubrics, and numeric bands.
 */
import { describe, it, expect } from 'vitest';
import {
  gradeAnswer,
  getGrader,
  hasGrader,
  listGraderEngines,
  registerGrader,
  gradingModeFor,
  UnknownEngineError,
} from '@/lib/exercises/registry';
import { weightedRubricScore } from '@/lib/exercises/graders/manual';
import { statusForScore, clamp01, binary, type Grader } from '@/lib/exercises/types';
import { LEGACY_EXERCISE_KINDS } from '@/lib/exercises/builtin-types';

describe('registry', () => {
  it('registers all ten built-in engines', () => {
    expect(listGraderEngines()).toEqual([
      'code_block_review',
      'essay',
      'fill_blank',
      'mcq',
      'mcq_multi',
      'numeric_range',
      'order_steps',
      'rubric',
      'short_answer',
      'type_answer',
    ]);
  });

  it('still carries every legacy kind', () => {
    for (const kind of LEGACY_EXERCISE_KINDS) {
      expect(hasGrader(kind)).toBe(true);
    }
  });

  it('throws a typed error for an unknown engine instead of failing the learner', () => {
    expect(() => gradeAnswer('does_not_exist', {}, 'x')).toThrow(UnknownEngineError);
  });

  it('accepts a new engine at runtime — no switch to edit', () => {
    const alwaysHalf: Grader = {
      engine: 'test_always_half',
      mode: 'auto',
      secretPaths: [],
      payloadSchema: (getGrader('mcq') as Grader).payloadSchema,
      answerSchema: (getGrader('mcq') as Grader).answerSchema,
      grade: () => ({ status: 'partial', score: 0.5, autoGraded: true }),
    };
    registerGrader(alwaysHalf);
    expect(gradeAnswer('test_always_half', {}, 'anything')).toEqual({
      status: 'partial',
      score: 0.5,
      autoGraded: true,
    });
    expect(gradingModeFor('test_always_half')).toBe('auto');
  });

  it('merges type config underneath the payload', () => {
    // config supplies matchKind; the payload supplies accepts.
    const res = gradeAnswer('type_answer', { accepts: ['Hello'] }, 'hello', {
      config: { matchKind: 'exact_ci' },
    });
    expect(res.status).toBe('correct');
  });
});

describe('legacy engines keep boolean-equivalent behaviour', () => {
  it('mcq', () => {
    const p = { options: [{ id: 'a', text: 'A' }], correctId: 'a' };
    expect(gradeAnswer('mcq', p, 'a')).toEqual({ status: 'correct', score: 1, autoGraded: true });
    expect(gradeAnswer('mcq', p, 'b')).toEqual({
      status: 'incorrect',
      score: 0,
      autoGraded: true,
    });
  });

  it('order_steps length mismatch is incorrect, never partial', () => {
    const p = {
      steps: [
        { id: '1', text: 'a' },
        { id: '2', text: 'b' },
      ],
      correctOrder: ['1', '2'],
    };
    expect(gradeAnswer('order_steps', p, ['1']).status).toBe('incorrect');
    expect(gradeAnswer('order_steps', p, ['1', '2']).score).toBe(1);
  });

  it('every legacy engine only ever returns a settled 1 or 0', () => {
    const samples: Array<[string, unknown, unknown]> = [
      ['mcq', { options: [{ id: 'a', text: 'A' }], correctId: 'a' }, 'zzz'],
      ['mcq_multi', { options: [{ id: 'a', text: 'A' }], correctIds: ['a'] }, ['a']],
      [
        'fill_blank',
        { template: '_', blanks: [{ id: 1, accepts: ['x'], matchKind: 'exact' }] },
        { '1': 'x' },
      ],
      ['order_steps', { steps: [{ id: '1', text: 'a' }], correctOrder: ['1'] }, ['1']],
      ['type_answer', { accepts: ['x'], matchKind: 'exact' }, 'nope'],
      [
        'code_block_review',
        { code: 'x', question: 'q', options: [{ id: 'a', text: 'A' }], correctId: 'a' },
        'a',
      ],
    ];
    for (const [engine, payload, answer] of samples) {
      const r = gradeAnswer(engine, payload, answer);
      expect(r.autoGraded).toBe(true);
      expect([0, 1]).toContain(r.score);
      expect(['correct', 'incorrect']).toContain(r.status);
    }
  });
});

describe('essay', () => {
  const payload = { minWords: 5, guidanceMd: 'Viết đi', modelAnswerMd: 'BÍ MẬT' };

  it('never settles on submit — a human must read it', () => {
    const r = gradeAnswer('essay', payload, 'Đây là một bài viết đủ dài để tính');
    expect(r.status).toBe('pending_review');
    expect(r.score).toBe(0);
    expect(r.autoGraded).toBe(false);
  });

  it('notes a too-short answer without auto-failing it', () => {
    const r = gradeAnswer('essay', payload, 'ngắn');
    expect(r.status).toBe('pending_review');
    expect(r.feedback).toContain('ngắn hơn');
  });

  it('an empty answer is still pending, not incorrect', () => {
    expect(gradeAnswer('essay', {}, '').status).toBe('pending_review');
  });

  it('settles once a human supplies a score', () => {
    const r = gradeAnswer('essay', payload, 'bài viết', {
      manualScore: 0.75,
      feedback: 'Khá',
    });
    expect(r).toEqual({
      status: 'partial',
      score: 0.75,
      autoGraded: false,
      feedback: 'Khá',
    });
  });

  it('a full manual score reads as correct', () => {
    expect(gradeAnswer('essay', payload, 'x', { manualScore: 1 }).status).toBe('correct');
    expect(gradeAnswer('essay', payload, 'x', { manualScore: 0 }).status).toBe('incorrect');
  });

  it('declares its grading mode as manual', () => {
    expect(gradingModeFor('essay')).toBe('manual');
  });
});

describe('rubric', () => {
  const payload = {
    criteria: [
      { id: 'c1', label: 'Đúng khái niệm', weight: 3, guidance: 'BÍ MẬT' },
      { id: 'c2', label: 'Ví dụ thực tế', weight: 1 },
    ],
    passThreshold: 0.8,
  };

  it('waits for a human when no criterion scores exist', () => {
    const r = gradeAnswer('rubric', payload, 'bài làm');
    expect(r.status).toBe('pending_review');
    expect(r.autoGraded).toBe(false);
  });

  it('weights criteria rather than averaging them', () => {
    // c1 (weight 3) full, c2 (weight 1) zero -> 3/4
    const r = gradeAnswer('rubric', payload, 'bài làm', {
      rubricScores: { c1: 1, c2: 0 },
    });
    expect(r.score).toBeCloseTo(0.75, 10);
    expect(r.status).toBe('partial');
    expect(r.autoGraded).toBe(false);
  });

  it('clears the pass threshold below a perfect score', () => {
    // c1 full, c2 at 0.2 -> (3 + 0.2)/4 = 0.8 == threshold
    const r = gradeAnswer('rubric', payload, 'x', { rubricScores: { c1: 1, c2: 0.2 } });
    expect(r.score).toBeCloseTo(0.8, 10);
    expect(r.status).toBe('correct');
  });

  it('counts a criterion missing from the grade as zero', () => {
    const r = gradeAnswer('rubric', payload, 'x', { rubricScores: { c1: 1 } });
    expect(r.score).toBeCloseTo(0.75, 10);
  });

  it('all-zero is incorrect, not partial', () => {
    const r = gradeAnswer('rubric', payload, 'x', { rubricScores: { c1: 0, c2: 0 } });
    expect(r.status).toBe('incorrect');
    expect(r.score).toBe(0);
  });

  it('weightedRubricScore is pure and clamps out-of-range input', () => {
    const criteria = [
      { id: 'a', weight: 1 },
      { id: 'b', weight: 1 },
    ];
    expect(weightedRubricScore(criteria, { a: 5, b: -3 })).toBe(0.5);
    expect(weightedRubricScore([], {})).toBe(0);
  });

  it('rejects a payload with no criteria — an authoring bug must be loud', () => {
    expect(() => gradeAnswer('rubric', { criteria: [] }, 'x')).toThrow();
  });
});

describe('numeric_range', () => {
  it('accepts inside the tolerance band', () => {
    const p = { target: 100, tolerance: 5 };
    expect(gradeAnswer('numeric_range', p, 97).status).toBe('correct');
    expect(gradeAnswer('numeric_range', p, 105).status).toBe('correct');
    expect(gradeAnswer('numeric_range', p, 106).status).toBe('incorrect');
  });

  it('accepts an explicit min/max band', () => {
    const p = { min: 10, max: 20 };
    expect(gradeAnswer('numeric_range', p, 10).score).toBe(1);
    expect(gradeAnswer('numeric_range', p, 20).score).toBe(1);
    expect(gradeAnswer('numeric_range', p, 20.1).score).toBe(0);
  });

  it('awards partial credit in the wider band', () => {
    const p = { target: 100, tolerance: 1, partialTolerance: 10, partialScore: 0.4 };
    const r = gradeAnswer('numeric_range', p, 108);
    expect(r.status).toBe('partial');
    expect(r.score).toBe(0.4);
  });

  it('parses string answers, including a comma decimal', () => {
    const p = { target: 12.5, tolerance: 0 };
    expect(gradeAnswer('numeric_range', p, '12.5').status).toBe('correct');
    expect(gradeAnswer('numeric_range', p, ' 12,5 ').status).toBe('correct');
  });

  it('rejects non-numeric input without throwing', () => {
    const r = gradeAnswer('numeric_range', { target: 1, tolerance: 0 }, 'abc');
    expect(r.status).toBe('incorrect');
    expect(r.feedback).toBe('Đáp án phải là một con số.');
  });

  it('feedback never says which direction the answer was off', () => {
    const r = gradeAnswer('numeric_range', { target: 100, tolerance: 1 }, 5000);
    expect(r.feedback).not.toMatch(/\d/);
  });

  it('rejects a payload that describes no band at all', () => {
    expect(() => gradeAnswer('numeric_range', { unit: 'ms' }, 1)).toThrow();
  });
});

describe('short_answer', () => {
  it('an exact accept short-circuits to full credit', () => {
    const p = { accepts: ['idempotent'], matchKind: 'exact_ci' as const };
    expect(gradeAnswer('short_answer', p, ' Idempotent ').status).toBe('correct');
  });

  it('scores partial credit from weighted keywords', () => {
    const p = {
      keywords: [
        { text: 'immutable', weight: 3 },
        { text: 'rollback', weight: 1 },
      ],
    };
    const r = gradeAnswer('short_answer', p, 'Artifact phải immutable khi deploy');
    expect(r.score).toBeCloseTo(0.75, 10);
    expect(r.status).toBe('partial');
    expect(r.feedback).toBe('Nhắc tới 1/2 ý chính.');
  });

  it('full keyword coverage reads as correct', () => {
    const p = { keywords: [{ text: 'state', weight: 1 }] };
    expect(gradeAnswer('short_answer', p, 'Terraform lưu STATE ở S3.').status).toBe('correct');
  });

  it('honours a partial pass threshold', () => {
    const p = {
      passThreshold: 0.5,
      keywords: [
        { text: 'a', weight: 1 },
        { text: 'b', weight: 1 },
      ],
    };
    expect(gradeAnswer('short_answer', p, 'chỉ có a thôi').status).toBe('correct');
  });

  it('ignores punctuation and casing when matching keywords', () => {
    const p = { keywords: [{ text: 'blue green', weight: 1 }] };
    expect(gradeAnswer('short_answer', p, 'dùng Blue-Green deployment').status).toBe('correct');
  });

  it('an empty answer is incorrect', () => {
    expect(gradeAnswer('short_answer', { keywords: [] }, '   ').score).toBe(0);
  });
});

describe('score helpers', () => {
  it('clamp01 handles NaN and out-of-range', () => {
    expect(clamp01(Number.NaN)).toBe(0);
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(2)).toBe(1);
    expect(clamp01(0.3)).toBe(0.3);
  });

  it('statusForScore respects the threshold', () => {
    expect(statusForScore(1)).toBe('correct');
    expect(statusForScore(0)).toBe('incorrect');
    expect(statusForScore(0.5)).toBe('partial');
    expect(statusForScore(0.8, 0.8)).toBe('correct');
  });

  it('binary() is the settled all-or-nothing shape', () => {
    expect(binary(true)).toEqual({ status: 'correct', score: 1, autoGraded: true });
    expect(binary(false)).toEqual({ status: 'incorrect', score: 0, autoGraded: true });
  });
});
