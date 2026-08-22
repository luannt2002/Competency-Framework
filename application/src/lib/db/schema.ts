/**
 * Drizzle schema — mirrors the SQL design in PROMPT_DEVOPS_MASTERY_WEB_APP.md §4.
 *
 * Convention:
 * - Snake_case in DB (Drizzle infers from camelCase via `*` shorthand).
 * - Every workspace-scoped row has `workspaceId` indexed and RLS-protected.
 * - `auth.users` is Supabase's auth schema; we reference it via raw SQL.
 */
import { relations, sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  numeric,
  date,
  primaryKey,
  uniqueIndex,
  index,
  pgEnum,
} from 'drizzle-orm/pg-core';

/* ============================ ENUMS ============================ */
export const orgRoleEnum = pgEnum('org_role', ['owner', 'admin', 'member', 'viewer']);
export const visibilityEnum = pgEnum('workspace_visibility', ['private', 'public-readonly']);
export const templateAuthorEnum = pgEnum('template_author_kind', ['system', 'community']);
export const levelSourceEnum = pgEnum('level_source', ['self_claimed', 'learned', 'both', 'verified']);
export const lessonStatusEnum = pgEnum('lesson_status', [
  'not_started',
  'in_progress',
  'completed',
  'mastered',
]);
export const userLevelStatusEnum = pgEnum('user_level_status', [
  'locked',
  'unlocked',
  'completed',
]);
export const taskKindEnum = pgEnum('roadmap_task_kind', [
  'reading',
  'lab',
  'project',
  'assessment',
]);
export const taskStatusEnum = pgEnum('user_task_status', ['todo', 'doing', 'done', 'skipped']);
// `export_format` was widened from a pgEnum to plain text (migration 0013)
// so tenant-defined formats can flow through. Allowed values ('pdf' | 'xlsx'
// | 'json') are still validated at the app layer.
export const exportStatusEnum = pgEnum('export_status', [
  'queued',
  'running',
  'done',
  'failed',
]);

/* ============================ TENANCY ============================ */
export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const orgMembers = pgTable(
  'org_members',
  {
    orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull(),
    role: orgRoleEnum('role').notNull().default('member'),
    joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.orgId, t.userId] }) }),
);

export const workspaces = pgTable(
  'workspaces',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    ownerUserId: uuid('owner_user_id'),
    orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    /** Mô tả ngắn (1–2 câu). Hiện trên /share và thẻ /discover. */
    description: text('description'),
    icon: text('icon'),
    color: text('color'),
    frameworkTemplateId: uuid('framework_template_id'),
    visibility: visibilityEnum('visibility').default('private'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    ownerSlugUq: uniqueIndex('workspaces_owner_slug_uq').on(t.ownerUserId, t.slug),
    ownerIdx: index('workspaces_owner_idx').on(t.ownerUserId),
  }),
);

/* ============================ TEMPLATES ============================ */
export const frameworkTemplates = pgTable('framework_templates', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  domain: text('domain'),
  authorKind: templateAuthorEnum('author_kind').default('system'),
  authorUserId: uuid('author_user_id'),
  isPublished: boolean('is_published').default(true),
  forksCount: integer('forks_count').default(0),
  payload: jsonb('payload').notNull(),
  version: text('version').default('1.0.0'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

/* ============================ MATRIX AXIS ============================ */
export const skillCategories = pgTable(
  'skill_categories',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    description: text('description'),
    color: text('color'),
    icon: text('icon'),
    displayOrder: integer('display_order').default(0),
  },
  (t) => ({
    wsSlugUq: uniqueIndex('skill_categories_ws_slug_uq').on(t.workspaceId, t.slug),
  }),
);

export const skills = pgTable(
  'skills',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    categoryId: uuid('category_id').notNull().references(() => skillCategories.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    description: text('description'),
    tags: text('tags').array().default(sql`'{}'::text[]`),
    displayOrder: integer('display_order').default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    wsSlugUq: uniqueIndex('skills_ws_slug_uq').on(t.workspaceId, t.slug),
    wsCatIdx: index('skills_ws_cat_idx').on(t.workspaceId, t.categoryId),
  }),
);

export const competencyLevels = pgTable(
  'competency_levels',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    code: text('code').notNull(), // XS / S / M / L
    label: text('label').notNull(),
    numericValue: integer('numeric_value').notNull(),
    description: text('description'),
    examples: text('examples'),
    color: text('color'),
    displayOrder: integer('display_order').default(0),
  },
  (t) => ({
    wsCodeUq: uniqueIndex('competency_levels_ws_code_uq').on(t.workspaceId, t.code),
  }),
);

export const userSkillProgress = pgTable(
  'user_skill_progress',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull(),
    skillId: uuid('skill_id').notNull().references(() => skills.id, { onDelete: 'cascade' }),
    levelCode: text('level_code'),
    levelSource: levelSourceEnum('level_source').default('self_claimed'),
    noteMd: text('note_md'),
    evidenceUrls: text('evidence_urls').array().default(sql`'{}'::text[]`),
    whyThisLevel: text('why_this_level'),
    targetLevelCode: text('target_level_code'),
    crowns: integer('crowns').default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    wsUserSkillUq: uniqueIndex('usp_ws_user_skill_uq').on(t.workspaceId, t.userId, t.skillId),
    wsUserIdx: index('usp_ws_user_idx').on(t.workspaceId, t.userId),
  }),
);

/* ============================ LEARNING PATH AXIS ============================ */
export const levelTracks = pgTable(
  'level_tracks',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    levelCode: text('level_code').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    displayOrder: integer('display_order').default(0),
  },
  (t) => ({
    wsLvlUq: uniqueIndex('level_tracks_ws_lvl_uq').on(t.workspaceId, t.levelCode),
  }),
);

export const weeks = pgTable(
  'weeks',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    trackId: uuid('track_id').notNull().references(() => levelTracks.id, { onDelete: 'cascade' }),
    weekIndex: integer('week_index').notNull(),
    title: text('title').notNull(),
    summary: text('summary'),
    goals: text('goals').array().default(sql`'{}'::text[]`),
    keywords: text('keywords').array().default(sql`'{}'::text[]`),
    estHours: integer('est_hours').default(8),
    displayOrder: integer('display_order').default(0),
  },
  (t) => ({
    wsTrackWkUq: uniqueIndex('weeks_ws_track_idx_uq').on(t.workspaceId, t.trackId, t.weekIndex),
    wsTrackIdx: index('weeks_ws_track_idx').on(t.workspaceId, t.trackId, t.weekIndex),
  }),
);

export const modules = pgTable('modules', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  weekId: uuid('week_id').notNull().references(() => weeks.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  summary: text('summary'),
  displayOrder: integer('display_order').default(0),
});

export const lessons = pgTable(
  'lessons',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    moduleId: uuid('module_id').notNull().references(() => modules.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    introMd: text('intro_md'),
    estMinutes: integer('est_minutes').default(8),
    displayOrder: integer('display_order').default(0),
  },
  (t) => ({
    wsModSlugUq: uniqueIndex('lessons_ws_mod_slug_uq').on(t.workspaceId, t.moduleId, t.slug),
  }),
);

export const lessonSkillMap = pgTable(
  'lesson_skill_map',
  {
    lessonId: uuid('lesson_id').notNull().references(() => lessons.id, { onDelete: 'cascade' }),
    skillId: uuid('skill_id').notNull().references(() => skills.id, { onDelete: 'cascade' }),
    contributesToLevel: text('contributes_to_level').notNull(),
    weight: integer('weight').default(1),
  },
  (t) => ({ pk: primaryKey({ columns: [t.lessonId, t.skillId] }) }),
);

export const exercises = pgTable('exercises', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  lessonId: uuid('lesson_id').notNull().references(() => lessons.id, { onDelete: 'cascade' }),
  /**
   * Slug trỏ tới một dòng `exercise_types` — KHÔNG còn là enum.
   *
   * Migration 0006 đổi cột này từ `exercise_kind` enum sang text để tenant tự
   * khai dạng bài bằng dữ liệu, không cần deploy. Ràng buộc còn lại ở DB là
   * CHECK định dạng slug (`^[a-z][a-z0-9_]{1,47}$`), không phải whitelist giá trị.
   * Dạng nào hợp lệ do `exercise_types` quyết định lúc chạy.
   */
  kind: text('kind').notNull(),
  promptMd: text('prompt_md').notNull(),
  payload: jsonb('payload').notNull(),
  explanationMd: text('explanation_md'),
  xpAward: integer('xp_award').default(10),
  displayOrder: integer('display_order').default(0),
});

export const userLessonProgress = pgTable(
  'user_lesson_progress',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull(),
    lessonId: uuid('lesson_id').notNull().references(() => lessons.id, { onDelete: 'cascade' }),
    status: lessonStatusEnum('status').default('not_started'),
    bestScore: numeric('best_score', { precision: 4, scale: 3 }),
    attempts: integer('attempts').default(0),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true }),
  },
  (t) => ({
    wsUserLessonUq: uniqueIndex('ulp_ws_user_lesson_uq').on(t.workspaceId, t.userId, t.lessonId),
    wsUserIdx: index('ulp_ws_user_idx').on(t.workspaceId, t.userId),
  }),
);

export const userExerciseAttempts = pgTable(
  'user_exercise_attempts',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull(),
    exerciseId: uuid('exercise_id').notNull().references(() => exercises.id, { onDelete: 'cascade' }),
    answer: jsonb('answer'),
    /** Giữ đồng bộ với `status === 'correct'` để reader cũ chạy nguyên vẹn. */
    isCorrect: boolean('is_correct'),
    timeTakenMs: integer('time_taken_ms'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    /* ---- Cột chấm điểm, thêm bởi migration 0006 ----
       Chấm không còn trả boolean: tự luận cần trạng thái "chờ chấm", rubric cần
       điểm thành phần, và cần biết ai chấm lúc nào. Mọi cột đều nullable nên
       dòng có từ trước 0006 vẫn hợp lệ. */
    /** 0..1. NULL chỉ ở dòng có trước khi 0006 backfill. */
    score: numeric('score'),
    /** 'correct' | 'incorrect' | 'partial' | 'pending_review' — CHECK ở DB. */
    status: text('status'),
    feedbackMd: text('feedback_md'),
    gradedBy: uuid('graded_by'),
    gradedAt: timestamp('graded_at', { withTimezone: true }),
    /** Điểm từng tiêu chí khi chấm rubric: { [criterionId]: 0..1 }. */
    rubric: jsonb('rubric'),
  },
  (t) => ({
    wsUserCreatedIdx: index('uea_ws_user_created_idx').on(t.workspaceId, t.userId, t.createdAt),
  }),
);

export const userWeekProgress = pgTable(
  'user_week_progress',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull(),
    weekId: uuid('week_id').notNull().references(() => weeks.id, { onDelete: 'cascade' }),
    pctComplete: numeric('pct_complete', { precision: 4, scale: 3 }).default('0'),
    unlocked: boolean('unlocked').default(false),
    unlockedAt: timestamp('unlocked_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => ({
    wsUserWkUq: uniqueIndex('uwp_ws_user_wk_uq').on(t.workspaceId, t.userId, t.weekId),
  }),
);

export const userLevelProgress = pgTable(
  'user_level_progress',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull(),
    levelCode: text('level_code').notNull(),
    status: userLevelStatusEnum('status').default('locked'),
    unlockedAt: timestamp('unlocked_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => ({
    wsUserLvlUq: uniqueIndex('ulp2_ws_user_lvl_uq').on(t.workspaceId, t.userId, t.levelCode),
  }),
);

/* ============================ GAMIFICATION ============================ */
export const xpEvents = pgTable(
  'xp_events',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull(),
    amount: integer('amount').notNull(),
    reason: text('reason').notNull(),
    refKind: text('ref_kind'),
    refId: uuid('ref_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    wsUserCreatedIdx: index('xp_ws_user_created_idx').on(t.workspaceId, t.userId, t.createdAt),
  }),
);

export const streaks = pgTable(
  'streaks',
  {
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull(),
    currentStreak: integer('current_streak').default(0),
    longestStreak: integer('longest_streak').default(0),
    lastActiveDate: date('last_active_date'),
    freezeCount: integer('freeze_count').default(0),
  },
  (t) => ({ pk: primaryKey({ columns: [t.workspaceId, t.userId] }) }),
);

export const hearts = pgTable(
  'hearts',
  {
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull(),
    // numeric(3,1) chứ không phải integer: F9 trừ NỬA tim khi bỏ qua task.
    // Driver trả numeric về dạng CHUỖI — mọi chỗ đọc phải đi qua
    // `heartsToNumber()` trong lib/gamification/hearts.ts, đừng so sánh trực tiếp.
    current: numeric('current', { precision: 3, scale: 1 }).default('5'),
    max: integer('max').default(5),
    nextRefillAt: timestamp('next_refill_at', { withTimezone: true }),
    /** Đã trừ tim vì nghỉ học tới hết ngày nào (F8). Decay tính lười lúc đọc. */
    decayedThrough: date('decayed_through'),
  },
  (t) => ({ pk: primaryKey({ columns: [t.workspaceId, t.userId] }) }),
);

/**
 * Sổ chống cấp trùng tim.
 *
 * F11 cho +1 tim khi ôn lại bài đã xong. Không có sổ này thì mở đi mở lại một
 * bài cũ là tim đầy vô hạn — unique index (workspace, user, reason, ref, ngày)
 * khoá lại đúng một lần mỗi ngày cho mỗi lý do.
 */
export const heartGrants = pgTable(
  'heart_grants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull(),
    reason: text('reason').notNull(),
    refId: text('ref_id').notNull().default(''),
    grantedOn: date('granted_on').notNull(),
    amount: numeric('amount', { precision: 3, scale: 1 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    onceUq: uniqueIndex('heart_grants_once_uq').on(
      t.workspaceId,
      t.userId,
      t.reason,
      t.refId,
      t.grantedOn,
    ),
  }),
);

export const badges = pgTable(
  'badges',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    icon: text('icon'),
    rule: jsonb('rule'),
  },
  (t) => ({
    wsSlugUq: uniqueIndex('badges_ws_slug_uq').on(t.workspaceId, t.slug),
  }),
);

export const userBadges = pgTable(
  'user_badges',
  {
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull(),
    badgeId: uuid('badge_id').notNull().references(() => badges.id, { onDelete: 'cascade' }),
    grantedAt: timestamp('granted_at', { withTimezone: true }).defaultNow(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.workspaceId, t.userId, t.badgeId] }) }),
);

/* ============================ USER NOTES PER WEEK ============================ */
export const userWeekNotes = pgTable(
  'user_week_notes',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull(),
    weekId: uuid('week_id').notNull().references(() => weeks.id, { onDelete: 'cascade' }),
    bodyMd: text('body_md').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    wsUserWkIdx: index('uwn_ws_user_wk_idx').on(t.workspaceId, t.userId, t.weekId),
  }),
);

/* ============================ LABS (week hands-on) ============================ */
export const labs = pgTable('labs', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  weekId: uuid('week_id').notNull().references(() => weeks.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  bodyMd: text('body_md'),
  estMinutes: integer('est_minutes').default(30),
  displayOrder: integer('display_order').default(0),
});

export const userLabProgress = pgTable(
  'user_lab_progress',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull(),
    labId: uuid('lab_id').notNull().references(() => labs.id, { onDelete: 'cascade' }),
    status: text('status').default('todo'),
    evidenceUrls: text('evidence_urls').array().default(sql`'{}'::text[]`),
    note: text('note'),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    wsUserLabUq: uniqueIndex('ulabp_ws_user_lab_uq').on(t.workspaceId, t.userId, t.labId),
  }),
);

/* ============================ ACTIVITY ============================ */
export const activityLog = pgTable(
  'activity_log',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull(),
    kind: text('kind').notNull(),
    payload: jsonb('payload'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    wsUserCreatedIdx: index('activity_ws_user_created_idx').on(t.workspaceId, t.userId, t.createdAt),
  }),
);

/* ============================ DESIGN-ONLY (schema only) ============================ */
export const reviewSchedules = pgTable('review_schedules', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull(),
  refKind: text('ref_kind'),
  refId: uuid('ref_id').notNull(),
  easeFactor: numeric('ease_factor', { precision: 4, scale: 2 }).default('2.5'),
  intervalDays: integer('interval_days').default(1),
  dueAt: timestamp('due_at', { withTimezone: true }),
  lastReviewedAt: timestamp('last_reviewed_at', { withTimezone: true }),
});

export const exportJobs = pgTable('export_jobs', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull(),
  format: text('format'),
  status: exportStatusEnum('status').default('queued'),
  fileUrl: text('file_url'),
  error: text('error'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

/* ============================ RELATIONS ============================ */
export const workspaceRelations = relations(workspaces, ({ many }) => ({
  categories: many(skillCategories),
  skills: many(skills),
  levels: many(competencyLevels),
  tracks: many(levelTracks),
}));

export const categoryRelations = relations(skillCategories, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [skillCategories.workspaceId], references: [workspaces.id] }),
  skills: many(skills),
}));

export const skillRelations = relations(skills, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [skills.workspaceId], references: [workspaces.id] }),
  category: one(skillCategories, { fields: [skills.categoryId], references: [skillCategories.id] }),
  progress: many(userSkillProgress),
  lessons: many(lessonSkillMap),
}));

export const trackRelations = relations(levelTracks, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [levelTracks.workspaceId], references: [workspaces.id] }),
  weeks: many(weeks),
}));

export const weekRelations = relations(weeks, ({ one, many }) => ({
  track: one(levelTracks, { fields: [weeks.trackId], references: [levelTracks.id] }),
  modules: many(modules),
}));

export const moduleRelations = relations(modules, ({ one, many }) => ({
  week: one(weeks, { fields: [modules.weekId], references: [weeks.id] }),
  lessons: many(lessons),
}));

export const lessonRelations = relations(lessons, ({ one, many }) => ({
  module: one(modules, { fields: [lessons.moduleId], references: [modules.id] }),
  exercises: many(exercises),
  skills: many(lessonSkillMap),
}));

/* ============================ TYPE HELPERS ============================ */
export type Workspace = typeof workspaces.$inferSelect;
export type NewWorkspace = typeof workspaces.$inferInsert;
export type Skill = typeof skills.$inferSelect;
export type SkillCategory = typeof skillCategories.$inferSelect;
export type CompetencyLevel = typeof competencyLevels.$inferSelect;
export type UserSkillProgress = typeof userSkillProgress.$inferSelect;
export type Lesson = typeof lessons.$inferSelect;
export type Exercise = typeof exercises.$inferSelect;
export type FrameworkTemplate = typeof frameworkTemplates.$inferSelect;

/* ============================ V8 + V9 + ETL re-exports ============================ */
export * from './schema-v8';
export * from './schema-v9';
export * from './schema-etl';
export * from './schema-tree';
export * from './schema-rbac';
export * from './schema-journal';
export * from './schema-resources';
export * from './schema-social';
export * from './schema-appearance';
