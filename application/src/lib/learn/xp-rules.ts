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
  DAILY_STREAK_TICK: 5,
  STREAK_7: 50,
  STREAK_30: 300,
  BADGE_EARNED: 25,
} as const;

export type XpReason =
  | 'exercise_correct'
  | 'exercise_correct_retry'
  | 'lesson_complete'
  | 'lesson_mastered'
  | 'week_complete'
  | 'level_complete'
  | 'daily_streak'
  | 'streak_milestone'
  | 'badge_earned';
