/**
 * Exercise-type server actions — a tenant defines its own kinds of exercise
 * at runtime: no code change, no migration, no deploy.
 *
 * A "kind" is a row in `exercise_types`: a slug (what `exercises.kind` stores),
 * a label, a grading mode, the engine that grades it, and a declarative field
 * spec describing the payload the author fills in. Fields flagged `secret` are
 * stripped before anything reaches a learner — the tenant-facing version of
 * "the answer never leaves the server".
 *
 * Actions stay thin: validate (zod) -> resolveWorkspace -> call the domain in
 * `@/lib/exercises/type-repo` -> writeAudit. Rules live in lib/, testable.
 *
 * EDITOR+ throughout: inventing a kind changes how everyone's work is scored.
 */
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { RBAC_LEVELS } from '@/lib/rbac/levels';
import { writeAudit } from '@/lib/rbac/server';
import { resolveWorkspace } from '@/lib/rbac/resolve';
import { fieldSpecSchema } from '@/lib/exercises/field-spec';
import { listGraderEngines, getGrader } from '@/lib/exercises/registry';
import {
  listExerciseTypesForWorkspace,
  createExerciseType as createExerciseTypeInDb,
  updateExerciseType as updateExerciseTypeInDb,
  retireExerciseType as retireExerciseTypeInDb,
  type ExerciseTypeView,
} from '@/lib/exercises/type-repo';

/* ============================ shared shapes ============================ */

const gradingMode = z.enum(['auto', 'manual', 'hybrid']);

/** Same pattern as the `exercise_types_slug_check` constraint in SQL. */
const slugSchema = z
  .string()
  .min(2)
  .max(48)
  .regex(/^[a-z][a-z0-9_]{1,47}$/, 'slug must be lower_snake_case');

/* ============================ reads ============================ */

/** Engines available to build a kind on, with their default grading mode. */
export type EngineOption = {
  engine: string;
  mode: 'auto' | 'manual' | 'hybrid';
};

export async function listExerciseTypes(input: {
  workspaceSlug: string;
  includeInactive?: boolean;
}): Promise<{ types: ExerciseTypeView[]; engines: EngineOption[] }> {
  const parsed = z
    .object({ workspaceSlug: z.string(), includeInactive: z.boolean().optional() })
    .parse(input);

  // VIEWER can read the catalogue — it carries labels, never answers.
  const { ws } = await resolveWorkspace(parsed.workspaceSlug, RBAC_LEVELS.VIEWER);
  const types = await listExerciseTypesForWorkspace(ws.id, {
    includeInactive: parsed.includeInactive,
  });

  const engines: EngineOption[] = listGraderEngines().map((engine) => ({
    engine,
    mode: getGrader(engine)?.mode ?? 'auto',
  }));

  return { types, engines };
}

/* ============================ create ============================ */

const createInput = z.object({
  workspaceSlug: z.string(),
  slug: slugSchema,
  label: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  gradingMode,
  /** Must name a registered engine — validated again in the domain layer. */
  engine: z.string().min(1).max(48),
  payloadSchema: fieldSpecSchema.optional(),
  answerSchema: fieldSpecSchema.optional(),
  config: z.record(z.unknown()).optional(),
});

export async function createExerciseType(
  input: z.infer<typeof createInput>,
): Promise<ExerciseTypeView> {
  const parsed = createInput.parse(input);
  const { ws, user, ctx } = await resolveWorkspace(parsed.workspaceSlug, RBAC_LEVELS.EDITOR);

  const created = await createExerciseTypeInDb({
    workspaceId: ws.id,
    userId: user.id,
    slug: parsed.slug,
    label: parsed.label,
    description: parsed.description ?? null,
    gradingMode: parsed.gradingMode,
    engine: parsed.engine,
    payloadSchema: parsed.payloadSchema,
    answerSchema: parsed.answerSchema,
    config: parsed.config,
  });

  await writeAudit({
    workspaceId: ws.id,
    actorUserId: user.id,
    actorRole: ctx.role,
    action: 'exercise_type.create',
    resourceType: 'exercise_type',
    resourceId: created.id,
    before: null,
    after: {
      slug: created.slug,
      label: created.label,
      engine: created.engine,
      gradingMode: created.gradingMode,
      secretFields: created.secretFields,
    },
  });

  revalidatePath(`/w/${ws.slug}/grading/types`);
  return created;
}

/* ============================ update ============================ */

const updateInput = z.object({
  workspaceSlug: z.string(),
  id: z.string().uuid(),
  label: z.string().min(1).max(120).optional(),
  description: z.string().max(2000).nullable().optional(),
  gradingMode: gradingMode.optional(),
  payloadSchema: fieldSpecSchema.optional(),
  answerSchema: fieldSpecSchema.optional(),
  config: z.record(z.unknown()).optional(),
  isActive: z.boolean().optional(),
});

export async function updateExerciseType(
  input: z.infer<typeof updateInput>,
): Promise<ExerciseTypeView> {
  const parsed = updateInput.parse(input);
  const { ws, user, ctx } = await resolveWorkspace(parsed.workspaceSlug, RBAC_LEVELS.EDITOR);

  const { before, after } = await updateExerciseTypeInDb({
    workspaceId: ws.id,
    id: parsed.id,
    label: parsed.label,
    description: parsed.description,
    gradingMode: parsed.gradingMode,
    payloadSchema: parsed.payloadSchema,
    answerSchema: parsed.answerSchema,
    config: parsed.config,
    isActive: parsed.isActive,
  });

  await writeAudit({
    workspaceId: ws.id,
    actorUserId: user.id,
    actorRole: ctx.role,
    action: 'exercise_type.update',
    resourceType: 'exercise_type',
    resourceId: after.id,
    before: {
      label: before.label,
      gradingMode: before.gradingMode,
      isActive: before.isActive,
      secretFields: before.secretFields,
    },
    after: {
      label: after.label,
      gradingMode: after.gradingMode,
      isActive: after.isActive,
      secretFields: after.secretFields,
    },
  });

  revalidatePath(`/w/${ws.slug}/grading/types`);
  return after;
}

/* ============================ retire ============================ */

/**
 * Retire a kind. Deactivated (not deleted) while exercises still reference the
 * slug, so live lessons keep grading; hard-deleted only when unused.
 */
export async function retireExerciseType(input: {
  workspaceSlug: string;
  id: string;
}): Promise<{ deleted: boolean }> {
  const parsed = z
    .object({ workspaceSlug: z.string(), id: z.string().uuid() })
    .parse(input);
  const { ws, user, ctx } = await resolveWorkspace(parsed.workspaceSlug, RBAC_LEVELS.EDITOR);

  const { before, deleted } = await retireExerciseTypeInDb(ws.id, parsed.id);

  await writeAudit({
    workspaceId: ws.id,
    actorUserId: user.id,
    actorRole: ctx.role,
    action: deleted ? 'exercise_type.delete' : 'exercise_type.deactivate',
    resourceType: 'exercise_type',
    resourceId: parsed.id,
    before: { slug: before.slug, label: before.label, isActive: before.isActive },
    after: deleted ? null : { isActive: false },
  });

  revalidatePath(`/w/${ws.slug}/grading/types`);
  return { deleted };
}
