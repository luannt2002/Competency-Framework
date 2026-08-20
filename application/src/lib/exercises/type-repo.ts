/**
 * `exercise_types` persistence + business rules.
 *
 * Every function here is workspace-scoped. Reads return the tenant's own kinds
 * PLUS the global built-ins (`workspace_id IS NULL`); writes only ever touch
 * rows whose `workspace_id` equals the caller's workspace, so a forged id can
 * never edit another tenant's kind or a built-in.
 *
 * Server actions stay thin (validate -> resolveWorkspace -> call here ->
 * writeAudit); the rules live in this module so they are testable.
 */
import { and, asc, eq, isNull, or, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { exerciseTypes, type ExerciseType } from '@/lib/db/schema-exercises';
import { openExercises } from '@/lib/db/schema-exercises';
import { hasGrader, listGraderEngines } from './registry';
import { buildTypeResolver, type ExerciseTypeRowLike, type ResolvedExerciseType } from './resolve';
import { fieldSpecSchema, secretFieldsOf, type FieldSpec } from './field-spec';

export class ExerciseTypeError extends Error {
  code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
    this.name = 'ExerciseTypeError';
  }
}

/** What a caller sees. `isBuiltin` rows are read-only. */
export type ExerciseTypeView = {
  id: string;
  workspaceId: string | null;
  slug: string;
  label: string;
  description: string | null;
  gradingMode: string;
  engine: string;
  payloadSchema: unknown;
  answerSchema: unknown;
  config: unknown;
  secretFields: string[];
  isBuiltin: boolean;
  isActive: boolean;
  createdAt: Date;
};

function toView(row: ExerciseType): ExerciseTypeView {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    slug: row.slug,
    label: row.label,
    description: row.description,
    gradingMode: row.gradingMode,
    engine: row.engine,
    payloadSchema: row.payloadSchema,
    answerSchema: row.answerSchema,
    config: row.config,
    secretFields: row.secretFields ?? [],
    isBuiltin: row.isBuiltin,
    isActive: row.isActive,
    createdAt: row.createdAt,
  };
}

/** Visibility rule, in one place: my workspace's rows + the global built-ins. */
function visibleTo(workspaceId: string) {
  return or(eq(exerciseTypes.workspaceId, workspaceId), isNull(exerciseTypes.workspaceId));
}

/* ============================ reads ============================ */

/** Kinds usable in this workspace, built-ins last, stable by slug. */
export async function listExerciseTypesForWorkspace(
  workspaceId: string,
  opts: { includeInactive?: boolean } = {},
): Promise<ExerciseTypeView[]> {
  const where = opts.includeInactive
    ? visibleTo(workspaceId)
    : and(visibleTo(workspaceId), eq(exerciseTypes.isActive, true));

  const rows = await db
    .select()
    .from(exerciseTypes)
    .where(where)
    .orderBy(asc(exerciseTypes.isBuiltin), asc(exerciseTypes.slug));

  return rows.map(toView);
}

/**
 * `kind -> engine/mode/secretPaths` map for a workspace.
 *
 * `extraKinds` seeds the map with kinds observed on actual exercise rows, so a
 * kind whose type row was deleted still resolves (falling back to the code
 * registry) instead of throwing mid-lesson.
 */
export async function loadTypeResolver(
  workspaceId: string,
  extraKinds: string[] = [],
): Promise<Map<string, ResolvedExerciseType>> {
  const rows = await db
    .select({
      slug: exerciseTypes.slug,
      label: exerciseTypes.label,
      engine: exerciseTypes.engine,
      gradingMode: exerciseTypes.gradingMode,
      secretFields: exerciseTypes.secretFields,
      payloadSchema: exerciseTypes.payloadSchema,
      // The runner renders a tenant kind from this spec, so it has to travel
      // with the resolver rather than being fetched again per exercise.
      answerSchema: exerciseTypes.answerSchema,
      config: exerciseTypes.config,
      isBuiltin: exerciseTypes.isBuiltin,
    })
    .from(exerciseTypes)
    .where(and(visibleTo(workspaceId), eq(exerciseTypes.isActive, true)));

  return buildTypeResolver(rows as ExerciseTypeRowLike[], extraKinds);
}

/* ============================ writes ============================ */

export type CreateExerciseTypeInput = {
  workspaceId: string;
  userId: string;
  slug: string;
  label: string;
  description?: string | null;
  gradingMode: 'auto' | 'manual' | 'hybrid';
  engine: string;
  payloadSchema?: FieldSpec;
  answerSchema?: FieldSpec;
  config?: Record<string, unknown>;
};

/**
 * Create a tenant-owned kind.
 *
 * Rules:
 *  - `engine` must exist in the code registry (an engine IS code).
 *  - the slug must not collide with a built-in or with another kind in this
 *    workspace — `exercises.kind` is resolved by slug, so collisions would be
 *    ambiguous.
 *  - `secret_fields` is DERIVED from the payload spec, never taken on trust,
 *    so "I marked it secret" and "it is stripped" cannot drift apart.
 */
export async function createExerciseType(
  input: CreateExerciseTypeInput,
): Promise<ExerciseTypeView> {
  if (!hasGrader(input.engine)) {
    throw new ExerciseTypeError(
      `UNKNOWN_ENGINE:${input.engine}:available=${listGraderEngines().join(',')}`,
    );
  }

  const payloadSpec = fieldSpecSchema.parse(input.payloadSchema ?? { fields: [] });
  const answerSpec = fieldSpecSchema.parse(input.answerSchema ?? { fields: [] });

  const clash = await db
    .select({ id: exerciseTypes.id })
    .from(exerciseTypes)
    .where(and(visibleTo(input.workspaceId), eq(exerciseTypes.slug, input.slug)))
    .limit(1);
  if (clash[0]) throw new ExerciseTypeError('SLUG_TAKEN');

  const [inserted] = await db
    .insert(exerciseTypes)
    .values({
      workspaceId: input.workspaceId,
      slug: input.slug,
      label: input.label,
      description: input.description ?? null,
      gradingMode: input.gradingMode,
      engine: input.engine,
      payloadSchema: payloadSpec,
      answerSchema: answerSpec,
      config: input.config ?? {},
      secretFields: secretFieldsOf(payloadSpec),
      isBuiltin: false,
      isActive: true,
      createdByUserId: input.userId,
    })
    .returning();
  if (!inserted) throw new ExerciseTypeError('INSERT_FAILED');
  return toView(inserted);
}

export type UpdateExerciseTypeInput = {
  workspaceId: string;
  id: string;
  label?: string;
  description?: string | null;
  gradingMode?: 'auto' | 'manual' | 'hybrid';
  payloadSchema?: FieldSpec;
  answerSchema?: FieldSpec;
  config?: Record<string, unknown>;
  isActive?: boolean;
};

/**
 * Update a tenant-owned kind. `slug` and `engine` are immutable: exercises
 * already point at the slug, and swapping the engine under them would silently
 * regrade history.
 */
export async function updateExerciseType(
  input: UpdateExerciseTypeInput,
): Promise<{ before: ExerciseTypeView; after: ExerciseTypeView }> {
  const before = await requireOwnType(input.workspaceId, input.id);

  const patch: Partial<typeof exerciseTypes.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (input.label !== undefined) patch.label = input.label;
  if (input.description !== undefined) patch.description = input.description;
  if (input.gradingMode !== undefined) patch.gradingMode = input.gradingMode;
  if (input.config !== undefined) patch.config = input.config;
  if (input.isActive !== undefined) patch.isActive = input.isActive;
  if (input.payloadSchema !== undefined) {
    const spec = fieldSpecSchema.parse(input.payloadSchema);
    patch.payloadSchema = spec;
    patch.secretFields = secretFieldsOf(spec);
  }
  if (input.answerSchema !== undefined) {
    patch.answerSchema = fieldSpecSchema.parse(input.answerSchema);
  }

  const [updated] = await db
    .update(exerciseTypes)
    .set(patch)
    // Tenant-scoped WHERE: a forged id cannot reach another workspace's row
    // even if the read above raced.
    .where(
      and(
        eq(exerciseTypes.id, input.id),
        eq(exerciseTypes.workspaceId, input.workspaceId),
        eq(exerciseTypes.isBuiltin, false),
      ),
    )
    .returning();
  if (!updated) throw new ExerciseTypeError('TYPE_NOT_FOUND');
  return { before, after: toView(updated) };
}

/**
 * Retire a kind. Deactivates rather than deletes when exercises still use it,
 * so existing lessons keep grading; deletes only when nothing references it.
 */
export async function retireExerciseType(
  workspaceId: string,
  id: string,
): Promise<{ before: ExerciseTypeView; deleted: boolean }> {
  const before = await requireOwnType(workspaceId, id);

  const inUse = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(openExercises)
    .where(
      and(eq(openExercises.workspaceId, workspaceId), eq(openExercises.kind, before.slug)),
    );

  if ((inUse[0]?.n ?? 0) > 0) {
    await db
      .update(exerciseTypes)
      .set({ isActive: false, updatedAt: new Date() })
      .where(
        and(
          eq(exerciseTypes.id, id),
          eq(exerciseTypes.workspaceId, workspaceId),
          eq(exerciseTypes.isBuiltin, false),
        ),
      );
    return { before, deleted: false };
  }

  await db
    .delete(exerciseTypes)
    .where(
      and(
        eq(exerciseTypes.id, id),
        eq(exerciseTypes.workspaceId, workspaceId),
        eq(exerciseTypes.isBuiltin, false),
      ),
    );
  return { before, deleted: true };
}

/** Load a row the workspace actually owns; built-ins are never writable. */
async function requireOwnType(workspaceId: string, id: string): Promise<ExerciseTypeView> {
  const rows = await db
    .select()
    .from(exerciseTypes)
    .where(and(eq(exerciseTypes.id, id), eq(exerciseTypes.workspaceId, workspaceId)))
    .limit(1);
  const row = rows[0];
  if (!row) throw new ExerciseTypeError('TYPE_NOT_FOUND');
  if (row.isBuiltin) throw new ExerciseTypeError('BUILTIN_READONLY');
  return toView(row);
}
