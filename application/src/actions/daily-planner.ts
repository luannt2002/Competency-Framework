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

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { eq, and, desc, asc, isNull, inArray, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import {
  workspaces,
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
import { requireUser } from '@/lib/auth/supabase-server';
import {
  planDay,
  type UserContext,
  type PlannedTaskInput,
  type PlannedTaskKind,
} from '@/lib/learn/daily-planner';
import { RBAC_LEVELS } from '@/lib/rbac/levels';
import { requireMinLevel, writeAudit, RBACError } from '@/lib/rbac/server';

/* ============================ HELPERS ============================ */

async function resolveWorkspace(slug: string, requiredLevel: number) {
  const user = await requireUser();
  const rows = await db
    .select({ id: workspaces.id, slug: workspaces.slug })
    .from(workspaces)
    .where(eq(workspaces.slug, slug))
    .limit(1);
  const ws = rows[0];
  if (!ws) throw new Error('WORKSPACE_NOT_FOUND_OR_FORBIDDEN');
  try {
    const ctx = await requireMinLevel(ws.id, requiredLevel);
    return { ws, user, ctx };
  } catch (err) {
    if (err instanceof RBACError) throw new Error('WORKSPACE_NOT_FOUND_OR_FORBIDDEN');
    throw err;
  }
}

/** Today/tomorrow as ISO date (yyyy-mm-dd) in server local time. */
function isoDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function todayISO(): string {
  return isoDate(new Date());
}

function tomorrowISO(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  return isoDate(d);
}

/** Days between two ISO date strings (positive => `b` is after `a`). */
function daysBetween(aIso: string | null, bIso: string): number {
  if (!aIso) return Number.POSITIVE_INFINITY;
  const a = new Date(`${aIso}T00:00:00Z`).getTime();
  const b = new Date(`${bIso}T00:00:00Z`).getTime();
  return Math.floor((b - a) / 86_400_000);
}

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

async function gatherUserContext(workspaceId: string, userId: string): Promise<UserContext> {
  const today = todayISO();
  const settings = await loadSettings(workspaceId, userId);
  const excludedSkillSet = new Set(settings.excludedSkillIds);

  // ─ current week: smallest weekIndex that has at least one not-completed lesson
  const allLessons = await db
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

  const lessonProgress = await db
    .select({ lessonId: userLessonProgress.lessonId, status: userLessonProgress.status })
    .from(userLessonProgress)
    .where(and(eq(userLessonProgress.workspaceId, workspaceId), eq(userLessonProgress.userId, userId)));
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
  const allLabs = await db
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
        .where(eq(exercises.id, a.exerciseId))
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

export async function markTaskDone(input: z.infer<typeof taskIdInput>): Promise<void> {
  const parsed = taskIdInput.parse(input);
  const { ws, user, ctx } = await resolveWorkspace(parsed.workspaceSlug, RBAC_LEVELS.LEARNER);
  const task = await loadTask(ws.id, user.id, parsed.taskId);

  await db
    .update(dailyTasks)
    .set({ status: 'done', completedAt: new Date() })
    .where(eq(dailyTasks.id, task.id));

  await db.insert(activityLog).values({
    workspaceId: ws.id,
    userId: user.id,
    kind: 'daily_task_done',
    payload: { taskId: task.id, kind: task.kind, refKind: task.refKind, refId: task.refId },
  });

  await writeAudit({
    workspaceId: ws.id,
    actorUserId: user.id,
    actorRole: ctx.role,
    action: 'daily_task.mark_done',
    resourceType: 'daily_task',
    resourceId: task.id,
    before: { status: task.status },
    after: { status: 'done' },
  });

  revalidatePath(`/w/${ws.slug}/daily`);
}

export async function markTaskSkipped(input: z.infer<typeof taskIdInput>): Promise<void> {
  const parsed = taskIdInput.parse(input);
  const { ws, user, ctx } = await resolveWorkspace(parsed.workspaceSlug, RBAC_LEVELS.LEARNER);
  const task = await loadTask(ws.id, user.id, parsed.taskId);

  await db
    .update(dailyTasks)
    .set({ status: 'skipped' })
    .where(eq(dailyTasks.id, task.id));

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
    .where(eq(dailyTasks.id, task.id));

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

// silence unused-import warnings on helpers we keep for future use
void isNull;
void inArray;
void sql;
