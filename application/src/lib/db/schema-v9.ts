/**
 * V9 tables; should be re-exported from schema.ts in a follow-up commit.
 *
 * Adds the Adaptive Daily Planner:
 *  - daily_tasks            : per-user list of tasks generated for a given day
 *  - user_planner_settings  : per-user planner preferences (goal XP, kinds, excludes)
 *
 * Both tables are workspace-scoped via `workspace_id` FK with onDelete: 'cascade'.
 *
 * For now imported directly where needed (drizzle migrations will still pick these
 * up via drizzle.config.ts when the schema entrypoint is updated).
 */
import { sql } from 'drizzle-orm';
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  timestamp,
  date,
  primaryKey,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { workspaces } from './schema';

/* ============================ ENUMS ============================ */

export const dailyTaskKindEnum = pgEnum('daily_task_kind', [
  'lesson',
  'lab',
  'weak_skill_review',
  'streak_keeper',
  'stretch',
]);

export const dailyTaskStatusEnum = pgEnum('daily_task_status', [
  'todo',
  'done',
  'skipped',
  'carried_over',
]);

/* ============================ TABLES ============================ */

/**
 * Daily tasks generated (or manually added) for a user on a given date.
 * A "plan" is just the set of rows for (workspaceId, userId, planDate).
 *
 * `refKind`/`refId` is a soft pointer at the originating object (lesson, lab,
 * skill, exercise). We avoid a hard FK so we can outlive deletions of source
 * rows without losing history.
 */
export const dailyTasks = pgTable(
  'daily_tasks',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull(),
    planDate: date('plan_date').notNull(),
    kind: dailyTaskKindEnum('kind').notNull(),
    refKind: text('ref_kind').notNull(),
    refId: uuid('ref_id').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    status: dailyTaskStatusEnum('status').notNull().default('todo'),
    estMinutes: integer('est_minutes').notNull().default(10),
    displayOrder: integer('display_order').notNull().default(0),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    wsUserDateIdx: index('daily_tasks_ws_user_date_idx').on(
      t.workspaceId,
      t.userId,
      t.planDate,
    ),
    wsUserStatusIdx: index('daily_tasks_ws_user_status_idx').on(
      t.workspaceId,
      t.userId,
      t.status,
    ),
    wsRefIdx: index('daily_tasks_ws_ref_idx').on(t.workspaceId, t.refKind, t.refId),
    // One (workspace, user, date, ref) is unique so generator re-runs are idempotent.
    wsUserDateRefUq: uniqueIndex('daily_tasks_ws_user_date_ref_uq').on(
      t.workspaceId,
      t.userId,
      t.planDate,
      t.refKind,
      t.refId,
    ),
  }),
);

/**
 * Per-user planner settings. Composite PK (workspaceId, userId).
 * `preferredKinds` filters the kinds the planner will surface (empty = all).
 * `excludedSkillIds` skips weak-skill picks for explicit skill IDs.
 */
export const userPlannerSettings = pgTable(
  'user_planner_settings',
  {
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull(),
    dailyGoalXp: integer('daily_goal_xp').notNull().default(60),
    preferredKinds: text('preferred_kinds').array().notNull().default(sql`'{}'::text[]`),
    excludedSkillIds: uuid('excluded_skill_ids').array().notNull().default(sql`'{}'::uuid[]`),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.workspaceId, t.userId] }),
  }),
);

/* ============================ TYPE HELPERS ============================ */

export type DailyTask = typeof dailyTasks.$inferSelect;
export type NewDailyTask = typeof dailyTasks.$inferInsert;

export type UserPlannerSettings = typeof userPlannerSettings.$inferSelect;
export type NewUserPlannerSettings = typeof userPlannerSettings.$inferInsert;

/** Kinds of daily tasks — kept in sync with the pg enum above. */
export type DailyTaskKind =
  | 'lesson'
  | 'lab'
  | 'weak_skill_review'
  | 'streak_keeper'
  | 'stretch';

/** Status of a daily task — kept in sync with the pg enum above. */
export type DailyTaskStatus = 'todo' | 'done' | 'skipped' | 'carried_over';
