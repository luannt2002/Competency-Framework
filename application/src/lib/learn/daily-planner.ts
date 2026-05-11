/**
 * Adaptive Daily Planner — pure engine.
 *
 * Given a snapshot of the user's state, produce 3-5 PlannedTaskInput rows
 * sorted by priority. This module has NO IO (no DB, no fetch, no time): the
 * caller is expected to gather context via DB queries and persist the output.
 *
 * Priority order (descending):
 *   1. streak_keeper       (when streakAtRisk)
 *   2. lesson              (continuation from current week)
 *   3. lab                 (unfinished from current week / carryover)
 *   4. weak_skill_review   (least-recently-touched weak skill)
 *   5. stretch             (next-level peek, only if 4 slots not filled)
 *
 * The planner caps total tasks at 5 and guarantees >=3 when possible. When
 * no context is available it returns a single streak_keeper if at-risk, or
 * a stretch entry if any weak skills exist, or an empty array.
 */

export type WeakSkillContext = {
  id: string;
  name: string;
  levelCode: string | null;
  daysSinceTouched: number;
};

export type LessonContext = {
  id: string;
  title: string;
  estMinutes: number;
};

export type LabContext = {
  id: string;
  title: string;
  estMinutes: number;
};

export type UserContext = {
  currentWeek: {
    id: string;
    weekIndex: number;
    title: string;
    lessonIds: string[];
    labIds: string[];
  } | null;
  unfinishedLessons: LessonContext[];
  unfinishedLabs: LabContext[];
  weakSkills: WeakSkillContext[];
  yesterdayExercise: { exerciseId: string; promptShort: string } | null;
  /** true if no XP today and last_active was yesterday */
  streakAtRisk: boolean;
};

export type PlannedTaskKind =
  | 'lesson'
  | 'lab'
  | 'weak_skill_review'
  | 'streak_keeper'
  | 'stretch';

export type PlannedTaskInput = {
  kind: PlannedTaskKind;
  refKind: string;
  refId: string;
  title: string;
  description?: string;
  estMinutes: number;
};

export type DailyPlan = PlannedTaskInput[];

export type PlannerOptions = {
  /** Maximum number of tasks to emit. Default 5. */
  maxTasks?: number;
  /** Minimum desired number of tasks. Default 3. */
  minTasks?: number;
  /** When true, planner will fill with stretch goal if room remains. Default true. */
  includeStretch?: boolean;
  /** kinds to exclude from generation (e.g. user preferences). */
  excludeKinds?: PlannedTaskKind[];
};

const DEFAULT_OPTIONS: Required<PlannerOptions> = {
  maxTasks: 5,
  minTasks: 3,
  includeStretch: true,
  excludeKinds: [],
};

/**
 * Generate a daily plan from a user-context snapshot.
 *
 * Pure function — no IO, deterministic given inputs. Use this from server
 * actions after assembling the {@link UserContext}.
 */
export function planDay({
  userContext,
  options,
}: {
  userContext: UserContext;
  options?: PlannerOptions;
}): DailyPlan {
  const opts: Required<PlannerOptions> = { ...DEFAULT_OPTIONS, ...(options ?? {}) };
  const excluded = new Set<PlannedTaskKind>(opts.excludeKinds);
  const plan: PlannedTaskInput[] = [];

  const tryAdd = (task: PlannedTaskInput | null): boolean => {
    if (!task) return false;
    if (excluded.has(task.kind)) return false;
    if (plan.length >= opts.maxTasks) return false;
    // dedupe by (kind, refKind, refId)
    if (plan.some((p) => p.kind === task.kind && p.refKind === task.refKind && p.refId === task.refId)) {
      return false;
    }
    plan.push(task);
    return true;
  };

  // ── 1. Streak keeper (highest priority when at risk) ──────────────────
  if (userContext.streakAtRisk && userContext.yesterdayExercise) {
    tryAdd(makeStreakKeeper(userContext.yesterdayExercise));
  }

  // ── 2. Lesson from current unlocked week (continuation) ───────────────
  const lessonPick = pickLessonFromWeek(userContext);
  if (lessonPick) tryAdd(lessonPick);

  // ── 3. Lab — unfinished from current week or carryover ────────────────
  const labPick = pickLab(userContext);
  if (labPick) tryAdd(labPick);

  // ── 4. Weak-skill review (least-recently-touched first) ───────────────
  const weakPick = pickWeakSkill(userContext);
  if (weakPick) tryAdd(weakPick);

  // ── 5. Stretch goal — only if we still have headroom ──────────────────
  if (opts.includeStretch && plan.length < opts.maxTasks) {
    const stretchPick = pickStretch(userContext);
    if (stretchPick) tryAdd(stretchPick);
  }

  // ── Fallback: backfill with extra lessons/labs to hit minTasks ────────
  if (plan.length < opts.minTasks) {
    for (const l of userContext.unfinishedLessons) {
      if (plan.length >= opts.minTasks) break;
      tryAdd({
        kind: 'lesson',
        refKind: 'lesson',
        refId: l.id,
        title: l.title,
        estMinutes: l.estMinutes,
      });
    }
  }
  if (plan.length < opts.minTasks) {
    for (const lab of userContext.unfinishedLabs) {
      if (plan.length >= opts.minTasks) break;
      tryAdd({
        kind: 'lab',
        refKind: 'lab',
        refId: lab.id,
        title: lab.title,
        estMinutes: lab.estMinutes,
      });
    }
  }
  if (plan.length < opts.minTasks) {
    for (const skill of [...userContext.weakSkills].sort(
      (a, b) => b.daysSinceTouched - a.daysSinceTouched,
    )) {
      if (plan.length >= opts.minTasks) break;
      tryAdd(makeWeakReview(skill));
    }
  }

  return plan;
}

/* ============================ INTERNAL HELPERS ============================ */

function makeStreakKeeper(yesterday: { exerciseId: string; promptShort: string }): PlannedTaskInput {
  return {
    kind: 'streak_keeper',
    refKind: 'exercise',
    refId: yesterday.exerciseId,
    title: 'Keep your streak alive',
    description: yesterday.promptShort
      ? `Quick replay: ${yesterday.promptShort}`
      : 'Replay yesterday\'s exercise — light & fast.',
    estMinutes: 3,
  };
}

function pickLessonFromWeek(ctx: UserContext): PlannedTaskInput | null {
  const week = ctx.currentWeek;
  if (!week) return null;
  // Prefer an unfinished lesson that belongs to currentWeek; fall back to first unfinished.
  const inWeek = ctx.unfinishedLessons.find((l) => week.lessonIds.includes(l.id));
  const pick = inWeek ?? ctx.unfinishedLessons[0];
  if (!pick) return null;
  return {
    kind: 'lesson',
    refKind: 'lesson',
    refId: pick.id,
    title: pick.title,
    description: `Continue ${week.title} (week ${week.weekIndex})`,
    estMinutes: pick.estMinutes,
  };
}

function pickLab(ctx: UserContext): PlannedTaskInput | null {
  const week = ctx.currentWeek;
  // Prefer labs that belong to the current week, else any unfinished (carryover).
  const inWeek = week
    ? ctx.unfinishedLabs.find((lab) => week.labIds.includes(lab.id))
    : undefined;
  const pick = inWeek ?? ctx.unfinishedLabs[0];
  if (!pick) return null;
  return {
    kind: 'lab',
    refKind: 'lab',
    refId: pick.id,
    title: pick.title,
    description: inWeek
      ? `Hands-on for current week`
      : `Carryover lab — finish before moving on`,
    estMinutes: pick.estMinutes,
  };
}

function pickWeakSkill(ctx: UserContext): PlannedTaskInput | null {
  if (ctx.weakSkills.length === 0) return null;
  // Pick the least-recently-touched weak skill (highest daysSinceTouched).
  const sorted = [...ctx.weakSkills].sort(
    (a, b) => b.daysSinceTouched - a.daysSinceTouched,
  );
  const pick = sorted[0];
  if (!pick) return null;
  return makeWeakReview(pick);
}

function makeWeakReview(skill: WeakSkillContext): PlannedTaskInput {
  const lvl = skill.levelCode ?? 'unset';
  return {
    kind: 'weak_skill_review',
    refKind: 'skill',
    refId: skill.id,
    title: `Review: ${skill.name}`,
    description: `Weak skill (${lvl}) — ${skill.daysSinceTouched}d since last touch`,
    estMinutes: 6,
  };
}

function pickStretch(ctx: UserContext): PlannedTaskInput | null {
  // Stretch = next-level preview. We piggy-back on the most recent (smallest
  // daysSinceTouched) weak skill that DOES have a levelCode set: that's where
  // they're closest to the next rung. Fall back to any weak skill.
  if (ctx.weakSkills.length === 0) return null;
  const recent = [...ctx.weakSkills]
    .filter((s) => s.levelCode !== null)
    .sort((a, b) => a.daysSinceTouched - b.daysSinceTouched)[0];
  const pick = recent ?? ctx.weakSkills[0];
  if (!pick) return null;
  return {
    kind: 'stretch',
    refKind: 'skill',
    refId: pick.id,
    title: `Stretch: peek next level for ${pick.name}`,
    description: pick.levelCode
      ? `Currently ${pick.levelCode} — preview what's required at the next rung.`
      : `Set your starting level and preview the next rung.`,
    estMinutes: 8,
  };
}
