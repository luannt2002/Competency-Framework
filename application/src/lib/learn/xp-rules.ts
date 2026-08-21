/**
 * XP and gamification constants. Server-side.
 */
export const XP = {
  EXERCISE_CORRECT_FIRST: 10,
  EXERCISE_CORRECT_RETRY: 5,
  LESSON_COMPLETE_BONUS: 20,
  LESSON_MASTERED_BONUS: 30,
  WEEK_COMPLETE_BONUS: 100,
  LEVEL_COMPLETE_BONUS: 500,
  /** Ticking one Daily Planner task. Priced like a leaf node (NODE_XP.LEAF). */
  DAILY_TASK_COMPLETE: 10,
  DAILY_STREAK_TICK: 5,
  STREAK_7: 50,
  STREAK_30: 300,
  BADGE_EARNED: 25,
  /** F5 — a reviewer approving evidence that verifies a skill. One-off per skill+user. */
  SKILL_VERIFIED: 30,
} as const;

/**
 * XP for completing a roadmap tree node, keyed by how much of the tree the
 * node represents (USER_FLOWS.md → Flow F "Kiếm XP"):
 *
 *   leaf → 10 · level 2 → 50 · level 1 → 200 · root → 500
 *
 * `depth` is `roadmap_tree_nodes.depth` (0 = root).
 */
export const NODE_XP = {
  ROOT: 500,
  LEVEL_1: 200,
  LEVEL_2: 50,
  LEAF: 10,
} as const;

/** Streak lengths that pay a one-off bonus (Flow F "Milestone streak badges"). */
export const STREAK_MILESTONES: ReadonlyArray<{ days: number; bonus: number }> = [
  { days: 7, bonus: XP.STREAK_7 },
  { days: 30, bonus: XP.STREAK_30 },
];

/**
 * XP earned for marking one tree node done. Pure — unit-tested.
 *
 * A node with no children is always a leaf (10 XP) no matter how shallow it
 * sits; a container pays by depth. Containers deeper than level 2 fall back to
 * the leaf award because the tree is unbounded in depth and the spec only
 * prices the first three rungs.
 */
export function nodeCompletionXp(input: { depth: number; hasChildren: boolean }): number {
  if (!input.hasChildren) return NODE_XP.LEAF;
  if (input.depth <= 0) return NODE_XP.ROOT;
  if (input.depth === 1) return NODE_XP.LEVEL_1;
  if (input.depth === 2) return NODE_XP.LEVEL_2;
  return NODE_XP.LEAF;
}

/** Bonus payable when the streak counter lands exactly on a milestone. */
export function streakMilestoneBonus(currentStreak: number): number {
  return STREAK_MILESTONES.find((m) => m.days === currentStreak)?.bonus ?? 0;
}

export type XpReason =
  | 'exercise_correct'
  | 'exercise_correct_retry'
  | 'lesson_complete'
  | 'lesson_mastered'
  | 'week_complete'
  | 'level_complete'
  | 'node_complete'
  | 'daily_task_complete'
  | 'daily_streak'
  | 'streak_milestone'
  | 'badge_earned'
  | 'skill_verified';
