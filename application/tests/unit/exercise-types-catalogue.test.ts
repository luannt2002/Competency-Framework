/**
 * The exercise-type catalogue: built-in registry vs. the SQL seed, and the
 * declarative field spec that lets a tenant define a kind without code.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  BUILTIN_EXERCISE_TYPES,
  LEGACY_EXERCISE_KINDS,
  getBuiltinExerciseType,
  isBuiltinExerciseKind,
} from '@/lib/exercises/builtin-types';
import { listGraderEngines, hasGrader } from '@/lib/exercises/registry';
import {
  buildZodFromSpec,
  fieldSpecSchema,
  parseFieldSpec,
  secretFieldsOf,
  FIELD_TYPES,
} from '@/lib/exercises/field-spec';

const MIGRATION = resolve(__dirname, '../../drizzle/migrations/0006_open_exercise_types.sql');

describe('built-in types', () => {
  it('keeps the six legacy kinds — 72 exercise rows point at these slugs', () => {
    for (const kind of LEGACY_EXERCISE_KINDS) {
      expect(isBuiltinExerciseKind(kind)).toBe(true);
    }
    expect(BUILTIN_EXERCISE_TYPES.slice(0, 6).map((t) => t.slug)).toEqual([
      ...LEGACY_EXERCISE_KINDS,
    ]);
  });

  it('every built-in names a registered engine', () => {
    for (const t of BUILTIN_EXERCISE_TYPES) {
      expect(hasGrader(t.engine), `engine missing for ${t.slug}`).toBe(true);
    }
  });

  it('every registered engine is reachable through a built-in kind', () => {
    const engines = new Set(BUILTIN_EXERCISE_TYPES.map((t) => t.engine));
    for (const e of listGraderEngines()) {
      expect(engines.has(e), `engine ${e} has no built-in type`).toBe(true);
    }
  });

  it('essay is manual and rubric is hybrid', () => {
    expect(getBuiltinExerciseType('essay')?.gradingMode).toBe('manual');
    expect(getBuiltinExerciseType('rubric')?.gradingMode).toBe('hybrid');
  });

  it('slugs are unique and match the SQL slug CHECK pattern', () => {
    const slugs = BUILTIN_EXERCISE_TYPES.map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of slugs) expect(s).toMatch(/^[a-z][a-z0-9_]{1,47}$/);
  });
});

describe('migration seed matches the code registry', () => {
  const sql = readFileSync(MIGRATION, 'utf-8');

  /** Parse the seeded rows out of the INSERT block. */
  const seeded = [...sql.matchAll(
    /\(NULL, '([a-z_]+)', '([^']*)', '(auto|manual|hybrid)', '([a-z_]+)', true, true\)/g,
  )].map((m) => ({
    slug: m[1] ?? '',
    label: m[2] ?? '',
    gradingMode: m[3] ?? '',
    engine: m[4] ?? '',
  }));

  it('seeds one row per built-in type, in the same order', () => {
    expect(seeded.map((s) => s.slug)).toEqual(BUILTIN_EXERCISE_TYPES.map((t) => t.slug));
  });

  it('label / grading mode / engine agree with the TS definitions', () => {
    for (const row of seeded) {
      const ts = getBuiltinExerciseType(row.slug);
      expect(ts, `no TS definition for ${row.slug}`).toBeDefined();
      expect(row.label).toBe(ts?.label);
      expect(row.gradingMode).toBe(ts?.gradingMode);
      expect(row.engine).toBe(ts?.engine);
    }
  });

  it('is written to be re-runnable', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "exercise_types"');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS');
    expect(sql).toContain('WHEN duplicate_object THEN NULL');
    expect(sql).toContain('DO NOTHING');
  });

  it('adds every grading column the attempt table needs', () => {
    for (const col of ['score', 'status', 'feedback_md', 'graded_by', 'graded_at', 'rubric']) {
      expect(sql).toContain(`ADD COLUMN IF NOT EXISTS "${col}"`);
    }
  });

  it('converts kind off the enum without a value whitelist', () => {
    expect(sql).toContain(`ALTER COLUMN "kind" TYPE text`);
    // A format guard, not a value list — the whole point is that the kind set
    // stays open. (`notifications.kind` further down IS a value list; the slug
    // regex is what proves `exercises.kind` is not.)
    expect(sql).toContain(`ADD CONSTRAINT "exercises_kind_slug_check"`);
    expect(sql).toContain(`CHECK ("kind" ~ '^[a-z][a-z0-9_]{1,47}$')`);
    const exercisesBlock = sql.slice(0, sql.indexOf('CREATE TABLE IF NOT EXISTS "exercise_types"'));
    expect(exercisesBlock).not.toMatch(/CHECK \("kind" IN \(/);
  });
});

describe('field spec -> zod (tenant-defined payloads)', () => {
  const spec = fieldSpecSchema.parse({
    fields: [
      { key: 'scenario', label: 'Tình huống', type: 'markdown', required: true },
      { key: 'expected', label: 'Đáp án', type: 'text', required: true, secret: true },
      { key: 'weight', label: 'Trọng số', type: 'number' },
      { key: 'tags', label: 'Nhãn', type: 'string_list' },
    ],
  });

  it('requires the required fields', () => {
    const schema = buildZodFromSpec(spec);
    expect(schema.safeParse({ scenario: 'x', expected: 'y' }).success).toBe(true);
    expect(schema.safeParse({ scenario: 'x' }).success).toBe(false);
  });

  it('enforces field types', () => {
    const schema = buildZodFromSpec(spec);
    expect(
      schema.safeParse({ scenario: 'x', expected: 'y', weight: 'heavy' }).success,
    ).toBe(false);
    expect(schema.safeParse({ scenario: 'x', expected: 'y', tags: ['a'] }).success).toBe(true);
    expect(schema.safeParse({ scenario: 'x', expected: 'y', tags: 'a' }).success).toBe(false);
  });

  it('derives secret fields from the spec — the tenant-facing answer flag', () => {
    expect(secretFieldsOf(spec)).toEqual(['expected']);
  });

  it('rejects keys that are not plain identifiers', () => {
    const bad = fieldSpecSchema.safeParse({
      fields: [{ key: 'drop table;', label: 'x', type: 'string' }],
    });
    expect(bad.success).toBe(false);
  });

  it('rejects unknown field types', () => {
    const bad = fieldSpecSchema.safeParse({
      fields: [{ key: 'a', label: 'x', type: 'blob' }],
    });
    expect(bad.success).toBe(false);
  });

  it('supports every advertised field type', () => {
    const all = fieldSpecSchema.parse({
      fields: FIELD_TYPES.map((t, i) => ({ key: `f${i}`, label: t, type: t })),
    });
    expect(() => buildZodFromSpec(all)).not.toThrow();
  });

  it('degrades a malformed stored spec to empty instead of throwing', () => {
    expect(parseFieldSpec(null)).toEqual({ fields: [] });
    expect(parseFieldSpec({ fields: 'nope' })).toEqual({ fields: [] });
    expect(parseFieldSpec(undefined).fields).toEqual([]);
  });
});
