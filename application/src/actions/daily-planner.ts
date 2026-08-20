/**
 * Daily Planner server actions.
 *
 * - getOrGenerateDailyPlan: idempotent — returns today's tasks for the user;
 *   if none exist, gathers context and calls planDay() to populate them.
 * - markTaskDone / markTaskSkipped: status transitions on a daily_task row.
 * - carryOverTask: marks the task carried_over and inserts a new copy for
 *   tomorrow with the same ref.
 * - updatePlannerSettings: upsert per-user planner settings.
 *
 * All mutations log to activity_log + audit_log. All paths gate by RBAC.
 */
'use server';
import { resolveWorkspace } from '@/lib/rbac/resolve';
import { isoDate, todayISO, tomorrowISO, daysBetween } from '@/lib/learn/planner-dates';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { eq, and, desc, asc, max as drizzleMax } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import {
  activityLog,
  lessons,
  labs,
  modules as modulesT,
  weeks,
  userLessonProgress,
  userLabProgress,
  userSkillProgress,
  skills,
  streaks,
  xpEvents,
  userExerciseAttempts,
  exercises,
} from '@/lib/db/schema';
import {
  dailyTasks,
  userPlannerSettings,
  type DailyTask,
  type DailyTaskKind,
} from '@/lib/db/schema-v9';
import {
  planDay,
  type UserContext,
  type NodeTaskContext,
  type PlannedTaskInput,
  type PlannedTaskKind,
} from '@/lib/learn/daily-planner';
import { insertXpOnce, awardStreakTick } from '@/lib/learn/xp-award';
import {
  listUnfinishedLeafNodes,
  DEFAULT_NODE_EST_MINUTES,
} from '@/lib/learn/node-progress';
import { XP } from '@/lib/learn/xp-rules';
import { RBAC_LEVELS } from '@/lib/rbac/levels';
import { writeAudit } from '@/lib/rbac/server';

/* ============================ READ + GENERATE ============================ */

export type DailyPlannerView = {
  planDate: string;
  tasks: DailyTask[];
  totalEstMinutes: number;
  xpToday: number;
  dailyGoalXp: number;
};

export async function getOrGenerateDailyPlan(workspaceSlug: string): Promise<DailyPlannerView> {
  // Personal planner data — LEARNER level (writes own daily_tasks rows).
  const { ws, user } = await resolveWorkspace(workspaceSlug, RBAC_LEVELS.LEARNER);
  const today = todayISO();

  // 1. If a plan already exists for today, just return it.
  const existing = await db
    .select()
    .from(dailyTasks)
    .where(
      and(
        eq(dailyTasks.workspaceId, ws.id),
        eq(dailyTasks.userId, user.id),
        eq(dailyTasks.planDate, today),
      ),
    )
    .orderBy(asc(dailyTasks.displayOrder), asc(dailyTasks.createdAt));

  if (existing.length > 0) {
    return assembleView(ws.id, user.id, today, existing);
  }

  // 2. Otherwise, gather context and generate.
  const context = await gatherUserContext(ws.id, user.id);
  const settings = await loadSettings(ws.id, user.id);
  const excludeKinds = (settings.preferredKinds.length > 0
    ? (['lesson', 'lab', 'weak_skill_review', 'streak_keeper', 'stretch'] as PlannedTaskKind[]).filter(
        (k) => !settings.preferredKinds.includes(k),
      )
    : []) as PlannedTaskKind[];

  const plan = planDay({ userContext: context, options: { excludeKinds } });

  // 3. Insert tasks. Use idempotent unique index for safety.
  if (plan.length > 0) {
    await db
      .insert(dailyTasks)
      .values(
        plan.map((t, i) => ({
          workspaceId: ws.id,
          userId: user.id,
          planDate: today,
          kind: t.kind,
          refKind: t.refKind,
          refId: t.refId,
          title: t.title,
          description: t.description ?? null,
          estMinutes: t.estMinutes,
          displayOrder: i,
        })),
      )
      .onConflictDoNothing();
  }

  await db.insert(activityLog).values({
    workspaceId: ws.id,
    userId: user.id,
    kind: 'daily_plan_generated',
    payload: { planDate: today, taskCount: plan.length },
  });

  const rows = await db
    .select()
    .from(dailyTasks)
    .where(
      and(
        eq(dailyTasks.workspaceId, ws.id),
        eq(dailyTasks.userId, user.id),
        eq(dailyTasks.planDate, today),
      ),
    )
    .orderBy(asc(dailyTasks.displayOrder), asc(dailyTasks.createdAt));

  return assembleView(ws.id, user.id, today, rows);
}

async function assembleView(
  workspaceId: string,
  userId: string,
  planDate: string,
  rows: DailyTask[],
): Promise<DailyPlannerView> {
  const settings = await loadSettings(workspaceId, userId);
  const totalEstMinutes = rows.reduce((sum, r) => sum + (r.estMinutes ?? 0), 0);

  const xpRows = await db
    .select({ amount: xpEvents.amount, createdAt: xpEvents.createdAt })
    .from(xpEvents)
    .where(and(eq(xpEvents.workspaceId, workspaceId), eq(xpEvents.userId, userId)));
  const xpToday = xpRows
    .filter((r) => r.createdAt && isoDate(r.createdAt) === planDate)
    .reduce((sum, r) => sum + (r.amount ?? 0), 0);

  return {
    planDate,
    tasks: rows,
    totalEstMinutes,
    xpToday,
    dailyGoalXp: settings.dailyGoalXp,
  };
}

async function loadSettings(workspaceId: string, userId: string) {
  const rows = await db
    .select()
    .from(userPlannerSettings)
    .where(
      and(eq(userPlannerSettings.workspaceId, workspaceId), eq(userPlannerSettings.userId, userId)),
    )
    .limit(1);
  const row = rows[0];
  if (row) {
    return {
      dailyGoalXp: row.dailyGoalXp,
      preferredKinds: (row.preferredKinds ?? []) as PlannedTaskKind[],
      excludedSkillIds: row.excludedSkillIds ?? [],
    };
  }
  return {
    dailyGoalXp: 60,
    preferredKinds: [] as PlannedTaskKind[],
    excludedSkillIds: [] as string[],
  };
}

/* ============================ CONTEXT GATHER ============================ */

/** Upper bound on how many candidate nodes we hand to the planner. */
const NODE_CANDIDATE_LIMIT = 12;

async function gatherUserContext(workspaceId: string, userId: string): Promise<UserContext> {
  const today = todayISO();
  const settings = await loadSettings(workspaceId, userId);
  const excludedSkillSet = new Set(settings.excludedSkillIds);

  // The roadmap tree is the surface the app actually navigates (/w/<ws>/n/…).
  // When a workspace has one, plan from it and skip the legacy week/lesson/lab
  // tables entirely — those rows have no page, so tasks pointing at them are
  // dead ends for the learner.
  const unfinishedNodes: NodeTaskContext[] = await listUnfinishedLeafNodes(
    workspaceId,
    userId,
    NODE_CANDIDATE_LIMIT,
  );
  const treeFirst = unfinishedNodes.length > 0;

  // ─ current week: smallest weekIndex that has at least one not-completed lesson
  const allLessons = treeFirst ? [] : await db
    .select({
      id: lessons.id,
      title: lessons.title,
      estMinutes: lessons.estMinutes,
      weekId: modulesT.weekId,
      weekIndex: weeks.weekIndex,
      weekTitle: weeks.title,
    })
    .from(lessons)
    .innerJoin(modulesT, eq(modulesT.id, lessons.moduleId))
    .innerJoin(weeks, eq(weeks.id, modulesT.weekId))
    .where(eq(lessons.workspaceId, workspaceId))
    .orderBy(asc(weeks.weekIndex), asc(lessons.displayOrder));

  const lessonProgress = treeFirst
    ? []
    : await db
        .select({ lessonId: userLessonProgress.lessonId, status: userLessonProgress.status })
        .from(userLessonProgress)
        .where(
          and(
            eq(userLessonProgress.workspaceId, workspaceId),
            eq(userLessonProgress.userId, userId),
          ),
        );
  const statusByLesson = new Map(lessonProgress.map((p) => [p.lessonId, p.status]));

  const unfinishedLessonsAll = allLessons.filter((l) => {
    const s = statusByLesson.get(l.id);
    return s !== 'completed' && s !== 'mastered';
  });

  let currentWeek: UserContext['currentWeek'] = null;
  if (unfinishedLessonsAll.length > 0) {
    const head = unfinishedLessonsAll[0];
    if (head) {
      const weekLessonIds = allLessons.filter((l) => l.weekId === head.weekId).map((l) => l.id);
      const weekLabRows = await db
        .select({ id: labs.id })
        .from(labs)
        .where(and(eq(labs.workspaceId, workspaceId), eq(labs.weekId, head.weekId)));
      currentWeek = {
        id: head.weekId,
        weekIndex: head.weekIndex,
        title: head.weekTitle,
        lessonIds: weekLessonIds,
        labIds: weekLabRows.map((r) => r.id),
      };
    }
  }

  const unfinishedLessons = unfinishedLessonsAll.slice(0, 10).map((l) => ({
    id: l.id,
    title: l.title,
    estMinutes: l.estMinutes ?? 8,
  }));

  // ─ unfinished labs (any in workspace where progress not done) ──────────
  const allLabs = treeFirst
    ? []
    : await db
        .select({
          id: labs.id,
          title: labs.title,
          estMinutes: labs.estMinutes,
          weekId: labs.weekId,
          status: userLabProgress.status,
        })
        .from(labs)
        .leftJoin(
          userLabProgress,
          and(eq(userLabProgress.labId, labs.id), eq(userLabProgress.userId, userId)),
        )
        .where(eq(labs.workspaceId, workspaceId));

  const unfinishedLabs = allLabs
    .filter((l) => l.status !== 'done')
    .slice(0, 10)
    .map((l) => ({
      id: l.id,
      title: l.title,
      estMinutes: l.estMinutes ?? 30,
    }));

  // ─ weak skills (level < S OR level_code IS NULL) ───────────────────────
  // We treat "weak" as: levelCode is null OR levelCode equals 'XS'. This
  // matches the spec ("level < S or level_code IS NULL").
  const skillRows = await db
    .select({
      id: skills.id,
      name: skills.name,
      levelCode: userSkillProgress.levelCode,
      updatedAt: userSkillProgress.updatedAt,
    })
    .from(skills)
    .leftJoin(
      userSkillProgress,
      and(
        eq(userSkillProgress.skillId, skills.id),
        eq(userSkillProgress.userId, userId),
        eq(userSkillProgress.workspaceId, workspaceId),
      ),
    )
    .where(eq(skills.workspaceId, workspaceId));

  const weakSkills = skillRows
    .filter((s) => !excludedSkillSet.has(s.id))
    .filter((s) => s.levelCode === null || s.levelCode === 'XS')
    .map((s) => ({
      id: s.id,
      name: s.name,
      levelCode: s.levelCode,
      daysSinceTouched: s.updatedAt
        ? Math.max(0, daysBetween(isoDate(s.updatedAt), today))
        : 999,
    }))
    // randomize order among ties so the same skill isn't picked every day
    .sort((a, b) => {
      if (b.daysSinceTouched !== a.daysSinceTouched) {
        return b.daysSinceTouched - a.daysSinceTouched;
      }
      // stable-ish jitter by id char
      return a.id.localeCompare(b.id);
    })
    .slice(0, 20);

  // ─ yesterday's exercise (most recent attempt before today) ─────────────
  const recentAttempts = await db
    .select({
      exerciseId: userExerciseAttempts.exerciseId,
      createdAt: userExerciseAttempts.createdAt,
    })
    .from(userExerciseAttempts)
    .where(
      and(
        eq(userExerciseAttempts.workspaceId, workspaceId),
        eq(userExerciseAttempts.userId, userId),
      ),
    )
    .orderBy(desc(userExerciseAttempts.createdAt))
    .limit(5);

  let yesterdayExercise: UserContext['yesterdayExercise'] = null;
  for (const a of recentAttempts) {
    if (a.createdAt && isoDate(a.createdAt) !== today) {
      const exRows = await db
        .select({ promptMd: exercises.promptMd })
        .from(exercises)
        .where(and(eq(exercises.id, a.exerciseId), eq(exercises.workspaceId, workspaceId)))
        .limit(1);
      const prompt = exRows[0]?.promptMd ?? '';
      yesterdayExercise = {
        exerciseId: a.exerciseId,
        promptShort: prompt.length > 80 ? `${prompt.slice(0, 77)}...` : prompt,
      };
      break;
    }
  }

  // ─ streak at risk: no XP today AND last_active_date == yesterday ───────
  const streakRows = await db
    .select()
    .from(streaks)
    .where(and(eq(streaks.workspaceId, workspaceId), eq(streaks.userId, userId)))
    .limit(1);
  const streakRow = streakRows[0];
  const todayXpRows = await db
    .select({ amount: xpEvents.amount, createdAt: xpEvents.createdAt })
    .from(xpEvents)
    .where(and(eq(xpEvents.workspaceId, workspaceId), eq(xpEvents.userId, userId)));
  const xpToday = todayXpRows
    .filter((r) => r.createdAt && isoDate(r.createdAt) === today)
    .reduce((sum, r) => sum + (r.amount ?? 0), 0);

  const lastActive = streakRow?.lastActiveDate ?? null;
  const lastActiveIso = lastActive ? lastActive : null;
  const streakAtRisk = xpToday === 0 && lastActiveIso !== null && daysBetween(lastActiveIso, today) === 1;

  return {
    currentWeek,
    unfinishedLessons,
    unfinishedLabs,
    weakSkills,
    yesterdayExercise,
    streakAtRisk,
    unfinishedNodes,
  };
}

/* ============================ MUTATIONS ============================ */

const taskIdInput = z.object({
  workspaceSlug: z.string(),
  taskId: z.string().uuid(),
});

async function loadTask(workspaceId: string, userId: string, taskId: string) {
  const rows = await db
    .select()
    .from(dailyTasks)
    .where(
      and(
        eq(dailyTasks.id, taskId),
        eq(dailyTasks.workspaceId, workspaceId),
        eq(dailyTasks.userId, userId),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) throw new Error('TASK_NOT_FOUND');
  return row;
}

export type TaskDoneResult = {
  /** XP credited by this tick (task award + streak tick). */
  xpAwarded: number;
  /** Streak length after the tick. */
  streak: number;
};

export async function markTaskDone(
  input: z.infer<typeof taskIdInput>,
): Promise<TaskDoneResult> {
  const parsed = taskIdInput.parse(input);
  const { ws, user, ctx } = await resolveWorkspace(parsed.workspaceSlug, RBAC_LEVELS.LEARNER);
  const task = await loadTask(ws.id, user.id, parsed.taskId);

  await db
    .update(dailyTasks)
    .set({ status: 'done', completedAt: new Date() })
    .where(and(eq(dailyTasks.id, task.id), eq(dailyTasks.workspaceId, ws.id)));

  // Flow B5: "Khi tick done → +XP ngay lập tức, Streak cập nhật".
  // Keyed on the task row so re-ticking a task never double-pays.
  const paid = await insertXpOnce({
    workspaceId: ws.id,
    userId: user.id,
    amount: XP.DAILY_TASK_COMPLETE,
    reason: 'daily_task_complete',
    refKind: 'daily_task',
    refId: task.id,
  });
  const streak = await awardStreakTick(ws.id, user.id);
  const xpAwarded = (paid ? XP.DAILY_TASK_COMPLETE : 0) + streak.xpAwarded;

  await db.insert(activityLog).values({
    workspaceId: ws.id,
    userId: user.id,
    kind: 'daily_task_done',
    payload: {
      taskId: task.id,
      kind: task.kind,
      refKind: task.refKind,
      refId: task.refId,
      xp: xpAwarded,
    },
  });

  await writeAudit({
    workspaceId: ws.id,
    actorUserId: user.id,
    actorRole: ctx.role,
    action: 'daily_task.mark_done',
    resourceType: 'daily_task',
    resourceId: task.id,
    before: { status: task.status },
    after: { status: 'done', xpAwarded, streak: streak.newStreak },
  });

  revalidatePath(`/w/${ws.slug}/daily`);
  revalidatePath(`/w/${ws.slug}`);
  return { xpAwarded, streak: streak.newStreak };
}

/* ============================ CUSTOM TASK ============================ */

const customTaskInput = z.object({
  workspaceSlug: z.string(),
  title: z.string().trim().min(1).max(200),
  estMinutes: z.number().int().min(1).max(600).optional(),
});

/**
 * Flow B5 "+ Add custom task" — the learner types their own item for today.
 *
 * Stored with `refKind: 'custom'` and a fresh uuid so it satisfies the
 * (workspace, user, date, ref) uniqueness index without colliding with the
 * generated tasks. `kind: 'stretch'` is the generic bucket of the persisted
 * enum (see schema-v9.dailyTaskKindEnum).
 */
export async function addCustomTask(
  input: z.infer<typeof customTaskInput>,
): Promise<{ id: string }> {
  const parsed = customTaskInput.parse(input);
  const { ws, user, ctx } = await resolveWorkspace(parsed.workspaceSlug, RBAC_LEVELS.LEARNER);
  const today = todayISO();

  const [{ next } = { next: null }] = await db
    .select({ next: drizzleMax(dailyTasks.displayOrder) })
    .from(dailyTasks)
    .where(
      and(
        eq(dailyTasks.workspaceId, ws.id),
        eq(dailyTasks.userId, user.id),
        eq(dailyTasks.planDate, today),
      ),
    );

  const [inserted] = await db
    .insert(dailyTasks)
    .values({
      workspaceId: ws.id,
      userId: user.id,
      planDate: today,
      kind: 'stretch',
      refKind: 'custom',
      refId: crypto.randomUUID(),
      title: parsed.title,
      description: 'Task bạn tự thêm',
      estMinutes: parsed.estMinutes ?? DEFAULT_NODE_EST_MINUTES,
      displayOrder: (next ?? -1) + 1,
    })
    .returning({ id: dailyTasks.id });
  if (!inserted) throw new Error('INSERT_FAILED');

  await db.insert(activityLog).values({
    workspaceId: ws.id,
    userId: user.id,
    kind: 'daily_task_added',
    payload: { taskId: inserted.id, title: parsed.title },
  });
  await writeAudit({
    workspaceId: ws.id,
    actorUserId: user.id,
    actorRole: ctx.role,
    action: 'daily_task.add_custom',
    resourceType: 'daily_task',
    resourceId: inserted.id,
    before: null,
    after: { title: parsed.title, planDate: today },
  });

  revalidatePath(`/w/${ws.slug}/daily`);
  return { id: inserted.id };
}

export async function markTaskSkipped(input: z.infer<typeof taskIdInput>): Promise<void> {
  const parsed = taskIdInput.parse(input);
  const { ws, user, ctx } = await resolveWorkspace(parsed.workspaceSlug, RBAC_LEVELS.LEARNER);
  const task = await loadTask(ws.id, user.id, parsed.taskId);

  await db
    .update(dailyTasks)
    .set({ status: 'skipped' })
    .where(and(eq(dailyTasks.id, task.id), eq(dailyTasks.workspaceId, ws.id)));

  await db.insert(activityLog).values({
    workspaceId: ws.id,
    userId: user.id,
    kind: 'daily_task_skipped',
    payload: { taskId: task.id, kind: task.kind },
  });

  await writeAudit({
    workspaceId: ws.id,
    actorUserId: user.id,
    actorRole: ctx.role,
    action: 'daily_task.mark_skipped',
    resourceType: 'daily_task',
    resourceId: task.id,
    before: { status: task.status },
    after: { status: 'skipped' },
  });

  revalidatePath(`/w/${ws.slug}/daily`);
}

export async function carryOverTask(input: z.infer<typeof taskIdInput>): Promise<void> {
  const parsed = taskIdInput.parse(input);
  const { ws, user, ctx } = await resolveWorkspace(parsed.workspaceSlug, RBAC_LEVELS.LEARNER);
  const task = await loadTask(ws.id, user.id, parsed.taskId);

  const tomorrow = tomorrowISO();

  await db
    .update(dailyTasks)
    .set({ status: 'carried_over' })
    .where(and(eq(dailyTasks.id, task.id), eq(dailyTasks.workspaceId, ws.id)));

  // Insert clone for tomorrow (idempotent via unique index)
  await db
    .insert(dailyTasks)
    .values({
      workspaceId: ws.id,
      userId: user.id,
      planDate: tomorrow,
      kind: task.kind,
      refKind: task.refKind,
      refId: task.refId,
      title: task.title,
      description: task.description,
      estMinutes: task.estMinutes,
      displayOrder: task.displayOrder,
    })
    .onConflictDoNothing();

  await db.insert(activityLog).values({
    workspaceId: ws.id,
    userId: user.id,
    kind: 'daily_task_carried_over',
    payload: { fromTaskId: task.id, toDate: tomorrow },
  });

  await writeAudit({
    workspaceId: ws.id,
    actorUserId: user.id,
    actorRole: ctx.role,
    action: 'daily_task.carry_over',
    resourceType: 'daily_task',
    resourceId: task.id,
    before: { status: task.status },
    after: { status: 'carried_over', toDate: tomorrow },
  });

  revalidatePath(`/w/${ws.slug}/daily`);
}

const settingsInput = z.object({
  workspaceSlug: z.string(),
  dailyGoalXp: z.number().int().min(10).max(1_000).optional(),
  preferredKinds: z
    .array(z.enum(['lesson', 'lab', 'weak_skill_review', 'streak_keeper', 'stretch']))
    .optional(),
  excludedSkillIds: z.array(z.string().uuid()).optional(),
});

export async function updatePlannerSettings(input: z.infer<typeof settingsInput>): Promise<void> {
  const parsed = settingsInput.parse(input);
  const { ws, user, ctx } = await resolveWorkspace(parsed.workspaceSlug, RBAC_LEVELS.LEARNER);

  const existing = await db
    .select()
    .from(userPlannerSettings)
    .where(
      and(
        eq(userPlannerSettings.workspaceId, ws.id),
        eq(userPlannerSettings.userId, user.id),
      ),
    )
    .limit(1);

  const update = {
    dailyGoalXp: parsed.dailyGoalXp ?? existing[0]?.dailyGoalXp ?? 60,
    preferredKinds: parsed.preferredKinds ?? existing[0]?.preferredKinds ?? [],
    excludedSkillIds: parsed.excludedSkillIds ?? existing[0]?.excludedSkillIds ?? [],
    updatedAt: new Date(),
  };

  if (existing[0]) {
    await db
      .update(userPlannerSettings)
      .set(update)
      .where(
        and(
          eq(userPlannerSettings.workspaceId, ws.id),
          eq(userPlannerSettings.userId, user.id),
        ),
      );
  } else {
    await db.insert(userPlannerSettings).values({
      workspaceId: ws.id,
      userId: user.id,
      ...update,
    });
  }

  await db.insert(activityLog).values({
    workspaceId: ws.id,
    userId: user.id,
    kind: 'planner_settings_updated',
    payload: {
      dailyGoalXp: update.dailyGoalXp,
      preferredKinds: update.preferredKinds,
      excludedSkillCount: update.excludedSkillIds.length,
    },
  });

  await writeAudit({
    workspaceId: ws.id,
    actorUserId: user.id,
    actorRole: ctx.role,
    action: 'planner_settings.update',
    resourceType: 'planner_settings',
    resourceId: null,
    before: existing[0]
      ? {
          dailyGoalXp: existing[0].dailyGoalXp,
          preferredKinds: existing[0].preferredKinds ?? [],
          excludedSkillIds: existing[0].excludedSkillIds ?? [],
        }
      : null,
    after: {
      dailyGoalXp: update.dailyGoalXp,
      preferredKinds: update.preferredKinds,
      excludedSkillIds: update.excludedSkillIds,
    },
  });

  revalidatePath(`/w/${ws.slug}/daily`);
}

// Re-export types for client component imports.
export type { DailyTask, DailyTaskKind };
export type { PlannedTaskInput };
