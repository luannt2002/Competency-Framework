/**
 * Adaptive Daily Planner — pure engine.
 *
 * Given a snapshot of the user's state, produce 3-5 PlannedTaskInput rows
 * sorted by priority. This module has NO IO (no DB, no fetch, no time): the
 * caller is expected to gather context via DB queries and persist the output.
 *
 * Priority order (descending):
 *   1. streak_keeper       (when streakAtRisk)
 *   2. tree node           (USER_FLOWS B5 "Nodes đang doing (ưu tiên hoàn
 *                           thành dở)" — in-progress first, then next up)
 *   3. lesson              (continuation from current week)
 *   4. lab                 (unfinished from current week / carryover)
 *   5. weak_skill_review   (least-recently-touched weak skill)
 *   6. stretch             (next-level peek, only if 4 slots not filled)
 *
 * The planner caps total tasks at 5 and guarantees >=3 when possible. When
 * no context is available it returns a single streak_keeper if at-risk, or
 * a stretch entry if any weak skills exist, or an empty array.
 *
 * Roadmap tree nodes and the legacy week/lesson tables are two different
 * learning surfaces. `nodes` is optional so the engine keeps working for
 * lesson-only workspaces; the caller feeds whichever surface the workspace
 * actually has.
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

/** An unfinished node of the roadmap tree (`roadmap_tree_nodes`). */
export type NodeTaskContext = {
  id: string;
  title: string;
  /** URL slug so the task row can deep-link to /w/<ws>/n/<slug>. */
  slug: string;
  /** roadmap_tree_nodes.node_type — decides the icon/kind shown. */
  nodeType: string;
  estMinutes: number;
  /** true when user_node_progress.status = 'doing' (started, not finished). */
  inProgress: boolean;
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
  /**
   * Unfinished roadmap tree nodes, already ordered by the caller
   * (in-progress first, then next-up in tree order). Optional: workspaces
   * that only use the legacy week/lesson tables leave it undefined.
   */
  unfinishedNodes?: NodeTaskContext[];
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
  /**
   * Longest estimate a node may carry and still be proposed as a task for
   * TODAY. A multi-day container (a whole "week" node) is real work but it is
   * not a daily task — the learner tracks those on the tree. Default 120.
   */
  maxTaskMinutes?: number;
};

const DEFAULT_OPTIONS: Required<PlannerOptions> = {
  maxTasks: 5,
  minTasks: 3,
  includeStretch: true,
  excludeKinds: [],
  maxTaskMinutes: 120,
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

  // ── 2. Roadmap tree nodes — "finish what you started" first ───────────
  // Cap the main pass at 2 so a long backlog cannot crowd out weak-skill
  // review; the backfill below tops up from the same list if needed.
  const nodePicks = pickNodeTasks(userContext.unfinishedNodes ?? [], opts.maxTaskMinutes);
  for (const t of nodePicks.slice(0, MAIN_PASS_NODE_SLOTS)) tryAdd(t);

  // ── 3. Lesson from current unlocked week (continuation) ───────────────
  const lessonPick = pickLessonFromWeek(userContext);
  if (lessonPick) tryAdd(lessonPick);

  // ── 4. Lab — unfinished from current week or carryover ────────────────
  const labPick = pickLab(userContext);
  if (labPick) tryAdd(labPick);

  // ── 5. Weak-skill review (least-recently-touched first) ───────────────
  const weakPick = pickWeakSkill(userContext);
  if (weakPick) tryAdd(weakPick);

  // ── 6. Stretch goal — only if we still have headroom ──────────────────
  if (opts.includeStretch && plan.length < opts.maxTasks) {
    const stretchPick = pickStretch(userContext);
    if (stretchPick) tryAdd(stretchPick);
  }

  // ── Fallback: backfill with extra nodes/lessons/labs to hit minTasks ──
  if (plan.length < opts.minTasks) {
    for (const t of nodePicks) {
      if (plan.length >= opts.minTasks) break;
      tryAdd(t);
    }
  }
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

/** How many tree-node tasks the priority pass may take before other kinds. */
const MAIN_PASS_NODE_SLOTS = 2;

/** node types that read as hands-on work rather than reading. */
const HANDS_ON_NODE_TYPES = new Set(['lab', 'project', 'exam', 'tool']);

/** Map a roadmap node onto one of the five persisted task kinds. */
export function nodeTaskKind(nodeType: string): PlannedTaskKind {
  return HANDS_ON_NODE_TYPES.has(nodeType) ? 'lab' : 'lesson';
}

/**
 * Candidate node tasks for today, in the caller's order.
 *
 * Nodes estimated longer than one sitting are dropped so the plan stays
 * actionable — unless dropping them would leave nothing at all, in which case
 * we keep the original list rather than hand back an empty day.
 */
function pickNodeTasks(
  nodes: readonly NodeTaskContext[],
  maxTaskMinutes: number,
): PlannedTaskInput[] {
  const fits = nodes.filter((n) => n.estMinutes <= maxTaskMinutes);
  return (fits.length > 0 ? fits : nodes).map(makeNodeTask);
}

/**
 * Turn an unfinished tree node into a planned task. `refKind: 'node'` is what
 * lets the UI deep-link the row back to /w/<slug>/n/<node-slug> — lesson/lab
 * refs point at legacy tables that have no page.
 */
function makeNodeTask(node: NodeTaskContext): PlannedTaskInput {
  return {
    kind: nodeTaskKind(node.nodeType),
    refKind: 'node',
    refId: node.id,
    title: node.title,
    description: node.inProgress
      ? 'Đang học dở — hoàn thành nốt hôm nay'
      : 'Bước tiếp theo trong cây học tập',
    estMinutes: node.estMinutes,
  };
}

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
