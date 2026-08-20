/**
 * sanitizePayload — the answer never leaves the server.
 *
 * The old code stripped answers with a hardcoded switch over six kinds inside
 * `startLesson`, so a seventh kind leaked by default. These tests pin the
 * replacement: every registered engine, old and new, is fed a payload whose
 * answer is a unique marker string, and the sanitized output must not contain
 * that marker anywhere in its JSON.
 */
import { describe, it, expect } from 'vitest';
import { sanitizePayload, containsAny } from '@/lib/exercises/sanitize';
import { getGrader, listGraderEngines } from '@/lib/exercises/registry';
import { resolveExerciseType, buildTypeResolver } from '@/lib/exercises/resolve';

type Sample = { payload: unknown; secrets: string[]; kept: string[] };

/**
 * A payload per engine whose every secret value is a findable marker.
 * `satisfies` (rather than a Record annotation) keeps the keys literal, so
 * `SAMPLES.mcq` is known-present under noUncheckedIndexedAccess.
 */
const SAMPLES = {
  mcq: {
    payload: {
      options: [
        { id: 'a', text: 'Option A' },
        { id: 'SECRET_MCQ', text: 'Option B' },
      ],
      correctId: 'SECRET_MCQ',
    },
    // The id also appears as an option id, which must stay — so we assert on
    // the `correctId` KEY rather than the value for this one.
    secrets: [],
    kept: ['Option A', 'Option B'],
  },
  mcq_multi: {
    payload: {
      options: [{ id: 'a', text: 'A' }],
      correctIds: ['SECRET_MULTI_1', 'SECRET_MULTI_2'],
    },
    secrets: ['SECRET_MULTI_1', 'SECRET_MULTI_2'],
    kept: ['A'],
  },
  fill_blank: {
    payload: {
      template: 'use ___ and ___',
      blanks: [
        { id: 1, accepts: ['SECRET_BLANK_1'], matchKind: 'exact_ci' },
        { id: 2, accepts: ['SECRET_BLANK_2'], matchKind: 'exact' },
      ],
    },
    secrets: ['SECRET_BLANK_1', 'SECRET_BLANK_2'],
    kept: ['use ___ and ___', 'exact_ci'],
  },
  order_steps: {
    payload: {
      steps: [
        { id: 's1', text: 'first' },
        { id: 's2', text: 'second' },
      ],
      correctOrder: ['SECRET_ORDER_A', 'SECRET_ORDER_B'],
    },
    secrets: ['SECRET_ORDER_A', 'SECRET_ORDER_B'],
    kept: ['first', 'second'],
  },
  type_answer: {
    payload: { accepts: ['SECRET_TYPED'], matchKind: 'regex', hint: 'starts with k' },
    secrets: ['SECRET_TYPED'],
    kept: ['starts with k'],
  },
  code_block_review: {
    payload: {
      // No quote characters: `containsAny` searches the JSON serialisation,
      // where a quote would appear escaped.
      code: 'resource aws_s3_bucket b {}',
      question: 'What is wrong?',
      options: [{ id: 'a', text: 'A' }],
      correctId: 'SECRET_REVIEW',
    },
    secrets: ['SECRET_REVIEW'],
    kept: ['resource aws_s3_bucket b {}', 'What is wrong?'],
  },
  essay: {
    payload: {
      minWords: 50,
      guidanceMd: 'Explain the tradeoff',
      modelAnswerMd: 'SECRET_MODEL_ANSWER',
      graderNotesMd: 'SECRET_GRADER_NOTES',
    },
    secrets: ['SECRET_MODEL_ANSWER', 'SECRET_GRADER_NOTES'],
    kept: ['Explain the tradeoff'],
  },
  rubric: {
    payload: {
      criteria: [
        { id: 'c1', label: 'Correctness', weight: 2, guidance: 'SECRET_GUIDANCE' },
        { id: 'c2', label: 'Clarity', weight: 1 },
      ],
      passThreshold: 0.8,
      guidanceMd: 'Answer in your own words',
      modelAnswerMd: 'SECRET_RUBRIC_MODEL',
    },
    secrets: ['SECRET_GUIDANCE', 'SECRET_RUBRIC_MODEL'],
    kept: ['Correctness', 'Clarity', 'Answer in your own words'],
  },
  numeric_range: {
    payload: {
      target: 424242,
      tolerance: 131313,
      min: 111111,
      max: 999999,
      partialTolerance: 222222,
      unit: 'ms',
      hint: 'order of magnitude',
    },
    secrets: ['424242', '131313', '111111', '999999', '222222'],
    kept: ['ms', 'order of magnitude'],
  },
  short_answer: {
    payload: {
      accepts: ['SECRET_SHORT'],
      keywords: [{ text: 'SECRET_KEYWORD', weight: 2 }],
      passThreshold: 0.5,
      hint: 'one sentence',
    },
    secrets: ['SECRET_SHORT', 'SECRET_KEYWORD'],
    kept: ['one sentence'],
  },
} satisfies Record<string, Sample>;

describe('sanitizePayload covers every registered engine', () => {
  it('has a sample for each engine — a new engine must add one here', () => {
    // `test_always_half` from the other spec file is not registered in this
    // module instance, so the list is exactly the built-ins.
    expect(Object.keys(SAMPLES).sort()).toEqual(listGraderEngines());
  });

  for (const [engine, sample] of Object.entries(SAMPLES)) {
    it(`${engine}: no secret value survives`, () => {
      const grader = getGrader(engine);
      expect(grader).toBeDefined();
      const clean = sanitizePayload(sample.payload, {
        secretPaths: grader?.secretPaths ?? [],
      });
      expect(containsAny(clean, sample.secrets)).toEqual([]);
    });

    it(`${engine}: public fields survive`, () => {
      const grader = getGrader(engine);
      const clean = sanitizePayload(sample.payload, {
        secretPaths: grader?.secretPaths ?? [],
      });
      expect(containsAny(clean, sample.kept).sort()).toEqual([...sample.kept].sort());
    });

    it(`${engine}: input is not mutated`, () => {
      const before = JSON.stringify(sample.payload);
      sanitizePayload(sample.payload, {
        secretPaths: getGrader(engine)?.secretPaths ?? [],
      });
      expect(JSON.stringify(sample.payload)).toBe(before);
    });
  }
});

describe('answer-bearing keys are removed', () => {
  const clean = (engine: string, payload: unknown) =>
    sanitizePayload(payload, { secretPaths: getGrader(engine)?.secretPaths ?? [] }) as Record<
      string,
      unknown
    >;

  it('mcq drops correctId but keeps the options to choose from', () => {
    const out = clean('mcq', SAMPLES.mcq.payload);
    expect(out).not.toHaveProperty('correctId');
    expect(Array.isArray(out.options)).toBe(true);
    expect((out.options as unknown[]).length).toBe(2);
  });

  it('mcq_multi drops correctIds', () => {
    expect(clean('mcq_multi', SAMPLES.mcq_multi.payload)).not.toHaveProperty('correctIds');
  });

  it('order_steps drops correctOrder but keeps the steps', () => {
    const out = clean('order_steps', SAMPLES.order_steps.payload);
    expect(out).not.toHaveProperty('correctOrder');
    expect((out.steps as unknown[]).length).toBe(2);
  });

  it('fill_blank strips accepts per blank and keeps id + matchKind', () => {
    const out = clean('fill_blank', SAMPLES.fill_blank.payload);
    const blanks = out.blanks as Array<Record<string, unknown>>;
    expect(blanks).toHaveLength(2);
    for (const b of blanks) {
      expect(b).not.toHaveProperty('accepts');
      expect(b).toHaveProperty('id');
      expect(b).toHaveProperty('matchKind');
    }
  });

  it('rubric keeps criteria labels/weights but drops per-criterion guidance', () => {
    const out = clean('rubric', SAMPLES.rubric.payload);
    const criteria = out.criteria as Array<Record<string, unknown>>;
    expect(criteria).toHaveLength(2);
    expect(criteria[0]).toMatchObject({ id: 'c1', label: 'Correctness', weight: 2 });
    expect(criteria[0]).not.toHaveProperty('guidance');
    expect(out).not.toHaveProperty('passThreshold');
  });

  it('numeric_range keeps only display fields', () => {
    const out = clean('numeric_range', SAMPLES.numeric_range.payload);
    expect(Object.keys(out).sort()).toEqual(['hint', 'unit']);
  });
});

describe('deny-list fail-safe', () => {
  it('strips well-known answer keys even when no path is declared', () => {
    const out = sanitizePayload(
      { question: 'q', correctId: 'X', solution: 'Y', answer: 'Z', expected: 'W' },
      { secretPaths: [] },
    ) as Record<string, unknown>;
    expect(Object.keys(out)).toEqual(['question']);
  });

  it('reaches arbitrarily deep, not just the top level', () => {
    const out = sanitizePayload(
      { parts: [{ sub: { correctIds: ['X'], label: 'keep' } }] },
      { secretPaths: [] },
    );
    expect(containsAny(out, ['X'])).toEqual([]);
    expect(containsAny(out, ['keep'])).toEqual(['keep']);
  });

  it('is case-insensitive about key names', () => {
    const out = sanitizePayload({ CorrectId: 'X', Solution: 'Y' }, {}) as Record<string, unknown>;
    expect(Object.keys(out)).toEqual([]);
  });

  it('leaves non-object payloads alone', () => {
    expect(sanitizePayload('plain', {})).toBe('plain');
    expect(sanitizePayload(null, {})).toBe(null);
    expect(sanitizePayload(7, {})).toBe(7);
  });

  it('refuses to guess on an uncloneable payload', () => {
    const cyclic: Record<string, unknown> = { a: 1 };
    cyclic.self = cyclic;
    expect(sanitizePayload(cyclic, {})).toEqual({});
  });
});

describe('tenant-defined kinds are stripped like built-ins', () => {
  /** A workspace invents `incident_review` on the essay engine. */
  const tenantRow = {
    slug: 'incident_review',
    label: 'Phân tích sự cố',
    engine: 'essay',
    gradingMode: 'manual',
    secretFields: ['expectedRootCause', 'scoringNotes'],
    payloadSchema: {
      fields: [
        { key: 'timeline', label: 'Timeline', type: 'markdown', required: true, secret: false },
        {
          key: 'expectedRootCause',
          label: 'Nguyên nhân gốc',
          type: 'text',
          required: true,
          secret: true,
        },
      ],
    },
    isBuiltin: false,
  };

  it('unions engine secret paths with the tenant field spec', () => {
    const resolved = resolveExerciseType('incident_review', tenantRow);
    expect(resolved.engine).toBe('essay');
    expect(resolved.gradingMode).toBe('manual');
    // essay's own paths + both tenant-declared fields
    expect(resolved.secretPaths).toEqual([
      'expectedRootCause',
      'graderNotesMd',
      'modelAnswerMd',
      'scoringNotes',
    ]);
  });

  it('strips the tenant-declared answer fields', () => {
    const resolved = resolveExerciseType('incident_review', tenantRow);
    const clean = sanitizePayload(
      {
        timeline: '10:02 alert fired',
        expectedRootCause: 'SECRET_ROOT_CAUSE',
        scoringNotes: 'SECRET_NOTES',
        modelAnswerMd: 'SECRET_MODEL',
      },
      { secretPaths: resolved.secretPaths },
    );
    expect(containsAny(clean, ['SECRET_ROOT_CAUSE', 'SECRET_NOTES', 'SECRET_MODEL'])).toEqual([]);
    expect(containsAny(clean, ['10:02 alert fired'])).toEqual(['10:02 alert fired']);
  });

  it('a tenant row shadows a built-in of the same slug', () => {
    const resolver = buildTypeResolver([
      { slug: 'type_answer', label: 'Built-in', engine: 'type_answer', gradingMode: 'auto', secretFields: [], isBuiltin: true },
      { slug: 'type_answer', label: 'Tenant override', engine: 'essay', gradingMode: 'manual', secretFields: [], isBuiltin: false },
    ]);
    const t = resolver.get('type_answer');
    expect(t?.label).toBe('Tenant override');
    expect(t?.engine).toBe('essay');
    expect(t?.gradingMode).toBe('manual');
  });

  it('a kind with no row at all still resolves to its built-in engine', () => {
    const resolver = buildTypeResolver([], ['mcq']);
    const t = resolver.get('mcq');
    expect(t?.engine).toBe('mcq');
    expect(t?.fromDb).toBe(false);
    expect(t?.secretPaths).toEqual(['correctId']);
  });
});
