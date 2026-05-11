/**
 * Central type definitions — single source of truth for client + server.
 * Mirrors Drizzle schema in src/lib/db/schema.ts.
 *
 * Rule: Components MUST import types from here, never define inline DTOs.
 */

/* ============ Enums ============ */
export type LevelCode = string; // 'XS' | 'S' | 'M' | 'L' OR custom codes (Intern/Junior/...)
export type LevelSource = 'self_claimed' | 'learned' | 'both';
export type LessonStatus = 'not_started' | 'in_progress' | 'completed' | 'mastered';
export type ExerciseKind =
  | 'mcq'
  | 'mcq_multi'
  | 'fill_blank'
  | 'order_steps'
  | 'type_answer'
  | 'code_block_review';
export type UserLevelStatus = 'locked' | 'unlocked' | 'completed';
export type WorkspaceVisibility = 'private' | 'public-readonly';

/* ============ Domain Entities ============ */
export interface Workspace {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  color: string | null;
  ownerUserId: string | null;
  frameworkTemplateId: string | null;
  visibility: WorkspaceVisibility | null;
  createdAt: string | Date | null;
}

export interface FrameworkTemplate {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  domain: string | null;
  forksCount: number | null;
  version: string | null;
  isPublished: boolean | null;
}

export interface CompetencyLevel {
  id: string;
  code: LevelCode;
  label: string;
  numericValue: number;
  description: string | null;
  examples: string | null;
  color: string | null;
  displayOrder: number | null;
}

export interface CareerStage {
  code: string;
  name: string;
  minNumeric: number;
  icon?: string;
  description?: string;
}

export interface SkillCategory {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  displayOrder: number | null;
}

export interface Skill {
  id: string;
  categoryId: string;
  slug: string;
  name: string;
  description: string | null;
  tags: string[] | null;
  displayOrder: number | null;
}

export interface UserSkillProgress {
  id: string;
  skillId: string;
  levelCode: LevelCode | null;
  levelSource: LevelSource | null;
  noteMd: string | null;
  whyThisLevel: string | null;
  evidenceUrls: string[] | null;
  targetLevelCode: LevelCode | null;
  crowns: number | null;
  updatedAt: string | Date | null;
}

/** Composed view: skill + its category + user's progress (for matrix table). */
export interface SkillRow {
  skillId: string;
  skillName: string;
  skillSlug: string;
  description: string | null;
  tags: string[] | null;
  categoryId: string;
  categoryName: string;
  categoryColor: string | null;
  levelCode: LevelCode | null;
  targetLevelCode: LevelCode | null;
  noteMd: string | null;
  whyThisLevel: string | null;
  evidenceUrls: string[] | null;
  crowns: number | null;
  updatedAt: Date | string | null;
}

/* ============ Learning ============ */
export interface LevelTrack {
  id: string;
  levelCode: LevelCode;
  title: string;
  description: string | null;
  displayOrder: number | null;
}

export interface Week {
  id: string;
  trackId: string;
  weekIndex: number;
  title: string;
  summary: string | null;
  goals: string[] | null;
  keywords: string[] | null;
  estHours: number | null;
}

export interface ModuleEntity {
  id: string;
  weekId: string;
  title: string;
  summary: string | null;
  displayOrder: number | null;
}

export interface Lesson {
  id: string;
  moduleId: string;
  slug: string;
  title: string;
  introMd: string | null;
  estMinutes: number | null;
  displayOrder: number | null;
}

/** Exercise as exposed to the client — correct answers stripped server-side. */
export interface ExerciseDTO {
  id: string;
  kind: ExerciseKind;
  promptMd: string;
  payload: unknown;
  xpAward: number;
}

export interface UserLessonProgress {
  id: string;
  lessonId: string;
  status: LessonStatus | null;
  bestScore: number | string | null;
  attempts: number | null;
  completedAt: string | Date | null;
}

export interface UserWeekProgress {
  weekId: string;
  pctComplete: number | string | null;
  unlocked: boolean | null;
  completedAt: string | Date | null;
}

export interface UserLevelProgress {
  levelCode: LevelCode;
  status: UserLevelStatus | null;
  unlockedAt: string | Date | null;
  completedAt: string | Date | null;
}

/* ============ Gamification ============ */
export interface Streak {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string | null;
  freezeCount: number;
}

export interface Hearts {
  current: number;
  max: number;
  nextRefillAt: string | Date | null;
}

export interface Badge {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
}

export interface ActivityEntry {
  id: string;
  kind: string;
  payload: unknown;
  createdAt: string | Date | null;
}

/* ============ Action results ============ */
export interface SubmitExerciseResult {
  isCorrect: boolean;
  explanationMd: string | null;
  xpAwarded: number;
  heartsLeft: number;
}

export interface CompleteLessonResult {
  xpAwarded: number;
  bonusReason: 'lesson_complete' | 'lesson_mastered';
  streakTicked: boolean;
  newStreak: number;
  crowns: Array<{ skillId: string; newCrowns: number; delta: number }>;
  badges: Badge[];
  weekCompleted: boolean;
  levelCompleted: boolean;
  newlyUnlockedLevelCodes: string[];
}

/* ============ Filters ============ */
export interface SkillFilters {
  categoryIds?: string[];
  levels?: string[];
  q?: string;
}
