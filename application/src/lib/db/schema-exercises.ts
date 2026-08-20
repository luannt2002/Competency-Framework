/**
 * Drizzle schema — hệ dạng bài mở.
 *
 * DDL ở drizzle/migrations/0006_open_exercise_types.sql.
 *
 * File này từng khai lại `exercises` và `user_exercise_attempts` vì schema.ts
 * chưa bắt kịp migration 0006 (kind còn là enum, thiếu 6 cột chấm). Hai bản
 * khai song song đã được GỘP: schema.ts giờ là nguồn duy nhất, và
 * `openExercises` / `exerciseAttempts` chỉ còn là bí danh trỏ về đó — giữ tên
 * cũ để 6 call site đang dùng không phải sửa.
 *
 * Bảng thật sự thuộc về file này chỉ còn `exercise_types`.
 */
import { sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { exercises, userExerciseAttempts, workspaces } from './schema';

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
/**
 * Bí danh của `exercises` trong schema.ts. Tên `openExercises` nhắc rằng `kind`
 * là tập MỞ (text + CHECK slug), không phải enum như trước 0006.
 */
export const openExercises = exercises;
export type OpenExercise = typeof exercises.$inferSelect;

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
/**
 * Bí danh của `user_exercise_attempts` trong schema.ts, đã gồm 6 cột chấm điểm
 * (score / status / feedback_md / graded_by / graded_at / rubric).
 */
export const exerciseAttempts = userExerciseAttempts;
export type ExerciseAttempt = typeof userExerciseAttempts.$inferSelect;
export type NewExerciseAttempt = typeof userExerciseAttempts.$inferInsert;
