/**
 * Drizzle schema — open exercise system.
 *
 * SQL DDL lives in drizzle/migrations/0006_open_exercise_types.sql.
 *
 * Why this file re-declares two tables that also exist in schema.ts
 * ----------------------------------------------------------------
 * `exercises` and `user_exercise_attempts` are declared in src/lib/db/schema.ts,
 * which is owned by another workstream. Migration 0006 widened both tables
 * (kind enum -> text, six grading columns) and schema.ts has not caught up.
 * Rather than edit a file we do not own, this module declares the *current*
 * physical shape of those tables:
 *
 *   - `openExercises`    — `exercises` with `kind` as text (open kind set)
 *   - `exerciseAttempts` — `user_exercise_attempts` incl. grading columns
 *
 * Both point at the same physical tables as their schema.ts counterparts, so
 * reads/writes interleave freely; they are supersets, not rivals. Old call
 * sites keep working unchanged (every added column is nullable, and the enum
 * column accepts its six historical values as plain text).
 *
 * When schema.ts is next touched, fold these in and delete the duplicates.
 */
import { sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  numeric,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { workspaces, lessons } from './schema';

/* ============================ exercise_types ============================ */

/** How a type's answers reach a final grade. */
export const GRADING_MODES = ['auto', 'manual', 'hybrid'] as const;
export type GradingMode = (typeof GRADING_MODES)[number];

/**
 * Catalogue of exercise kinds.
 *
 * `workspace_id IS NULL` marks a global built-in shipped with the product and
 * readable by every tenant; a non-null `workspace_id` is a kind that tenant
 * authored at runtime. Readers MUST scope with
 * `or(eq(workspaceId, ws.id), isNull(workspaceId))` — never a bare select.
 */
export const exerciseTypes = pgTable(
  'exercise_types',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid('workspace_id').references(() => workspaces.id, {
      onDelete: 'cascade',
    }),
    /** Value written into exercises.kind. */
    slug: text('slug').notNull(),
    label: text('label').notNull(),
    description: text('description'),
    gradingMode: text('grading_mode').notNull().default('auto'),
    /** Grader registry key — see src/lib/exercises/registry.ts. */
    engine: text('engine').notNull(),
    /** Declarative field spec for authored payloads (tenant types). */
    payloadSchema: jsonb('payload_schema').notNull().default({}),
    /** Declarative field spec for learner answers (tenant types). */
    answerSchema: jsonb('answer_schema').notNull().default({}),
    /** Engine options merged into the payload at grade time. */
    config: jsonb('config').notNull().default({}),
    /** Payload paths never serialized to a client (`a.b`, `a[].b`). */
    secretFields: text('secret_fields')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    isBuiltin: boolean('is_builtin').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    createdByUserId: uuid('created_by_user_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    wsSlugUq: uniqueIndex('et_ws_slug_uq').on(t.workspaceId, t.slug),
    wsActiveIdx: index('et_ws_active_idx').on(t.workspaceId, t.isActive),
  }),
);

export type ExerciseType = typeof exerciseTypes.$inferSelect;
export type NewExerciseType = typeof exerciseTypes.$inferInsert;

/* ============================ exercises (open kind) ============================ */

/**
 * `exercises` with `kind` typed as plain text. Identical table to
 * `exercises` in schema.ts — this declaration just stops TypeScript from
 * pretending the kind set is still the six-value enum.
 */
export const openExercises = pgTable('exercises', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  lessonId: uuid('lesson_id')
    .notNull()
    .references(() => lessons.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(),
  promptMd: text('prompt_md').notNull(),
  payload: jsonb('payload').notNull(),
  explanationMd: text('explanation_md'),
  xpAward: integer('xp_award').default(10),
  displayOrder: integer('display_order').default(0),
});

export type OpenExercise = typeof openExercises.$inferSelect;

/* ============================ attempts (with grading) ============================ */

/** Attempt lifecycle states. Mirrors `GradeResult['status']`. */
export const ATTEMPT_STATUSES = [
  'correct',
  'incorrect',
  'partial',
  'pending_review',
] as const;
export type AttemptStatus = (typeof ATTEMPT_STATUSES)[number];

/**
 * `user_exercise_attempts` including the grading columns added by 0006.
 *
 * `isCorrect` is kept in sync (`status === 'correct'`) so legacy readers —
 * computeLessonScore, hasCorrectAttempt — keep working untouched.
 */
export const exerciseAttempts = pgTable(
  'user_exercise_attempts',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull(),
    exerciseId: uuid('exercise_id')
      .notNull()
      .references(() => openExercises.id, { onDelete: 'cascade' }),
    answer: jsonb('answer'),
    isCorrect: boolean('is_correct'),
    timeTakenMs: integer('time_taken_ms'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    /** 0..1. NULL only on rows predating 0006's backfill. */
    score: numeric('score'),
    status: text('status'),
    feedbackMd: text('feedback_md'),
    gradedBy: uuid('graded_by'),
    gradedAt: timestamp('graded_at', { withTimezone: true }),
    /** Per-criterion scores for rubric grading: { [criterionId]: 0..1 }. */
    rubric: jsonb('rubric'),
  },
  (t) => ({
    wsUserCreatedIdx: index('uea_ws_user_created_idx').on(
      t.workspaceId,
      t.userId,
      t.createdAt,
    ),
  }),
);

export type ExerciseAttempt = typeof exerciseAttempts.$inferSelect;
export type NewExerciseAttempt = typeof exerciseAttempts.$inferInsert;
