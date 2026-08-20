/**
 * Kind -> engine resolution. Pure: takes rows, returns a lookup.
 *
 * An exercise stores a `kind` slug. That slug resolves to:
 *   - the engine that grades it,
 *   - the grading mode (does a human have to look at it?),
 *   - the full set of payload paths that must never reach a client.
 *
 * Secret paths are the UNION of what the engine declares and what the tenant
 * flagged in its own field spec. Union, never override: a tenant cannot widen
 * what an engine considers public, only narrow it further.
 *
 * The DB read lives in type-repo.ts; keeping this pure is what makes the
 * "answers never leak" rule unit-testable without a database.
 */
import { getGrader } from './registry';
import { getBuiltinExerciseType } from './builtin-types';
import { parseFieldSpec, secretFieldsOf, type FieldSpec } from './field-spec';
import type { GradingMode } from '@/lib/db/schema-exercises';

/** Minimal projection of an `exercise_types` row this module needs. */
export type ExerciseTypeRowLike = {
  slug: string;
  label: string;
  engine: string;
  gradingMode: string;
  secretFields: string[] | null;
  payloadSchema?: unknown;
  answerSchema?: unknown;
  config?: unknown;
  isBuiltin?: boolean;
};

export type ResolvedExerciseType = {
  kind: string;
  label: string;
  engine: string;
  gradingMode: GradingMode;
  /** Union of engine-declared and tenant-declared secret paths. */
  secretPaths: string[];
  config: Record<string, unknown>;
  /**
   * Answer fields the tenant declared, with anything flagged secret removed.
   * This is what lets the lesson runner render a kind nobody wrote code for:
   * no spec -> the runner falls back to a free-text box.
   */
  answerSpec: FieldSpec;
  /** False when no `exercise_types` row backed this kind (built-in fallback). */
  fromDb: boolean;
};

function normalizeMode(value: string | undefined, fallback: GradingMode): GradingMode {
  return value === 'auto' || value === 'manual' || value === 'hybrid' ? value : fallback;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Resolve a single kind from its (optional) type row. */
export function resolveExerciseType(
  kind: string,
  row?: ExerciseTypeRowLike,
): ResolvedExerciseType {
  const builtin = getBuiltinExerciseType(kind);
  const engine = row?.engine ?? builtin?.engine ?? kind;
  const grader = getGrader(engine);

  const declared = new Set<string>(grader?.secretPaths ?? []);
  for (const f of row?.secretFields ?? []) declared.add(f);
  // A tenant may also mark fields secret inside the payload spec itself.
  if (row?.payloadSchema) {
    for (const f of secretFieldsOf(parseFieldSpec(row.payloadSchema))) declared.add(f);
  }

  // A secret ANSWER field is a contradiction (the learner types it), but the
  // flag is tenant-controlled, so honour it by dropping the field rather than
  // shipping something a tenant asked to keep hidden.
  const answerSpec = parseFieldSpec(row?.answerSchema);

  return {
    kind,
    label: row?.label ?? builtin?.label ?? kind,
    engine,
    gradingMode: normalizeMode(
      row?.gradingMode,
      builtin?.gradingMode ?? grader?.mode ?? 'auto',
    ),
    secretPaths: [...declared].sort(),
    config: asRecord(row?.config),
    answerSpec: { fields: answerSpec.fields.filter((f) => !f.secret) },
    fromDb: row !== undefined,
  };
}

/**
 * Build a `kind -> ResolvedExerciseType` map.
 *
 * `rows` must already be workspace-scoped (tenant rows + global built-ins).
 * A tenant row shadows a built-in of the same slug, which is how a workspace
 * can, say, turn `type_answer` into a manually reviewed kind for itself only.
 * Kinds present on exercises but absent from `rows` fall back to the code
 * registry so a missing row degrades to old behaviour instead of a 500.
 */
export function buildTypeResolver(
  rows: ExerciseTypeRowLike[],
  kinds: string[] = [],
): Map<string, ResolvedExerciseType> {
  const bySlug = new Map<string, ExerciseTypeRowLike>();
  for (const r of rows) {
    const existing = bySlug.get(r.slug);
    // Tenant rows (isBuiltin false) win over global built-ins.
    if (!existing || (existing.isBuiltin && !r.isBuiltin)) bySlug.set(r.slug, r);
  }

  const out = new Map<string, ResolvedExerciseType>();
  for (const slug of bySlug.keys()) out.set(slug, resolveExerciseType(slug, bySlug.get(slug)));
  for (const kind of kinds) {
    if (!out.has(kind)) out.set(kind, resolveExerciseType(kind, undefined));
  }
  return out;
}
