/**
 * V8 — Verified Competency Engine schema additions.
 *
 * This module's tables should be re-exported from schema.ts in a follow-up commit;
 * for now imported directly where needed (drizzle migrations will still pick these
 * up via drizzle.config.ts when the schema entrypoint is updated).
 *
 * Tables added:
 *  - evidence_grades        : per-skill evidence (lab/project/peer/manager reviews)
 *  - role_profiles          : named role templates ("DevOps Junior", "SRE Senior", ...)
 *  - role_skill_requirements: required level + weight per skill, per role
 *  - user_role_targets      : a user opts into a role as their target
 *  - skill_audit_log        : append-only audit trail for skill-level events
 *
 * All tables are workspace-scoped via `workspace_id` FK with onDelete: 'cascade'.
 */
import { sql } from 'drizzle-orm';
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  numeric,
  timestamp,
  date,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { workspaces, skills } from './schema';

/* ============================ ENUMS ============================ */
export const evidenceKindEnum = pgEnum('evidence_kind', [
  'lab',
  'project',
  'peer_review',
  'manager_review',
]);

export const skillAuditActionEnum = pgEnum('skill_audit_action', [
  'level_changed',
  'evidence_added',
  'verified',
  'decayed',
]);

/* ============================ TABLES ============================ */

/**
 * Append-only evidence submissions backing a skill claim.
 * `score` is 0..100. `reviewer_user_id` is null for self-submitted lab/project rows.
 */
export const evidenceGrades = pgTable(
  'evidence_grades',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull(),
    skillId: uuid('skill_id')
      .notNull()
      .references(() => skills.id, { onDelete: 'cascade' }),
    kind: evidenceKindEnum('kind').notNull(),
    score: integer('score').notNull(),
    evidenceUrl: text('evidence_url'),
    reviewerUserId: uuid('reviewer_user_id'),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    wsUserSkillIdx: index('evgrades_ws_user_skill_idx').on(
      t.workspaceId,
      t.userId,
      t.skillId,
    ),
    wsKindIdx: index('evgrades_ws_kind_idx').on(t.workspaceId, t.kind),
  }),
);

/**
 * Named role profile (e.g. "DevOps Junior"). Can form a hierarchy via parentRoleId
 * so that a Senior role inherits Junior requirements at gap-analysis time.
 */
export const roleProfiles = pgTable(
  'role_profiles',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    parentRoleId: uuid('parent_role_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    wsSlugUq: uniqueIndex('role_profiles_ws_slug_uq').on(t.workspaceId, t.slug),
    wsParentIdx: index('role_profiles_ws_parent_idx').on(t.workspaceId, t.parentRoleId),
  }),
);

/**
 * One row per (role, skill). `requiredLevelCode` is the target competency code
 * (XS/S/M/L or custom). `weight` lets roles prioritise some skills over others
 * when computing aggregate readiness.
 */
export const roleSkillRequirements = pgTable(
  'role_skill_requirements',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roleProfiles.id, { onDelete: 'cascade' }),
    skillId: uuid('skill_id')
      .notNull()
      .references(() => skills.id, { onDelete: 'cascade' }),
    requiredLevelCode: text('required_level_code').notNull(),
    weight: numeric('weight', { precision: 4, scale: 2 }).default('1.00'),
  },
  (t) => ({
    wsRoleSkillUq: uniqueIndex('rsr_ws_role_skill_uq').on(
      t.workspaceId,
      t.roleId,
      t.skillId,
    ),
    wsRoleIdx: index('rsr_ws_role_idx').on(t.workspaceId, t.roleId),
  }),
);

/**
 * A user picks a role profile they are aiming for. Optional targetDate for plan UIs.
 */
export const userRoleTargets = pgTable(
  'user_role_targets',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull(),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roleProfiles.id, { onDelete: 'cascade' }),
    targetDate: date('target_date'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    wsUserRoleUq: uniqueIndex('urt_ws_user_role_uq').on(
      t.workspaceId,
      t.userId,
      t.roleId,
    ),
    wsUserIdx: index('urt_ws_user_idx').on(t.workspaceId, t.userId),
  }),
);

/**
 * Append-only audit trail of skill-level events. `from_value`/`to_value` are
 * stringified so the table can capture levels, scores, or any other delta.
 * `actor_user_id` is the user that performed the action (peer/manager for reviews,
 * the system for decays — null in that case).
 */
export const skillAuditLog = pgTable(
  'skill_audit_log',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull(),
    skillId: uuid('skill_id')
      .notNull()
      .references(() => skills.id, { onDelete: 'cascade' }),
    action: skillAuditActionEnum('action').notNull(),
    fromValue: text('from_value'),
    toValue: text('to_value'),
    reason: text('reason'),
    actorUserId: uuid('actor_user_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    wsUserSkillCreatedIdx: index('sal_ws_user_skill_created_idx').on(
      t.workspaceId,
      t.userId,
      t.skillId,
      t.createdAt,
    ),
  }),
);

/* ============================ TYPE HELPERS ============================ */
export type EvidenceGrade = typeof evidenceGrades.$inferSelect;
export type NewEvidenceGrade = typeof evidenceGrades.$inferInsert;

export type RoleProfile = typeof roleProfiles.$inferSelect;
export type NewRoleProfile = typeof roleProfiles.$inferInsert;

export type RoleSkillRequirement = typeof roleSkillRequirements.$inferSelect;
export type NewRoleSkillRequirement = typeof roleSkillRequirements.$inferInsert;

export type UserRoleTarget = typeof userRoleTargets.$inferSelect;
export type NewUserRoleTarget = typeof userRoleTargets.$inferInsert;

export type SkillAuditLog = typeof skillAuditLog.$inferSelect;
export type NewSkillAuditLog = typeof skillAuditLog.$inferInsert;

/** Kinds of evidence — kept in sync with the pg enum above. */
export type EvidenceKind = 'lab' | 'project' | 'peer_review' | 'manager_review';

/** Audit log actions — kept in sync with the pg enum above. */
export type SkillAuditAction = 'level_changed' | 'evidence_added' | 'verified' | 'decayed';
