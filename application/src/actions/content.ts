/**
 * Content authoring server actions — create/update modules, lessons, labs.
 * All workspace-scoped, RBAC-gated, activity-logged.
 */
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { eq, and, max as drizzleMax } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import {
  workspaces,
  modules as modulesT,
  lessons as lessonsT,
  labs as labsT,
  weeks as weeksT,
  activityLog,
} from '@/lib/db/schema';
import { requireUser } from '@/lib/auth/supabase-server';
import { toSlug } from '@/lib/utils';
import { RBAC_LEVELS } from '@/lib/rbac/levels';
import { requireMinLevel, writeAudit, RBACError } from '@/lib/rbac/server';

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

async function assertWeekInWorkspace(workspaceId: string, weekId: string) {
  const rows = await db
    .select({ id: weeksT.id })
    .from(weeksT)
    .where(and(eq(weeksT.id, weekId), eq(weeksT.workspaceId, workspaceId)))
    .limit(1);
  if (!rows[0]) throw new Error('WEEK_NOT_IN_WORKSPACE');
}

async function assertModuleInWorkspace(workspaceId: string, moduleId: string) {
  const rows = await db
    .select({ id: modulesT.id })
    .from(modulesT)
    .where(and(eq(modulesT.id, moduleId), eq(modulesT.workspaceId, workspaceId)))
    .limit(1);
  if (!rows[0]) throw new Error('MODULE_NOT_IN_WORKSPACE');
}

/* ============================ Modules ============================ */
const moduleInput = z.object({
  workspaceSlug: z.string(),
  weekId: z.string().uuid(),
  title: z.string().min(1).max(160),
  summary: z.string().max(2000).optional(),
});

export async function createModule(input: z.infer<typeof moduleInput>): Promise<{ id: string }> {
  const parsed = moduleInput.parse(input);
  const { ws, user, ctx } = await resolveWorkspace(parsed.workspaceSlug, RBAC_LEVELS.EDITOR);
  await assertWeekInWorkspace(ws.id, parsed.weekId);

  // Compute next displayOrder
  const [{ next } = { next: 0 }] = await db
    .select({ next: drizzleMax(modulesT.displayOrder) })
    .from(modulesT)
    .where(eq(modulesT.weekId, parsed.weekId));
  const nextOrder = (next ?? -1) + 1;

  const [inserted] = await db
    .insert(modulesT)
    .values({
      workspaceId: ws.id,
      weekId: parsed.weekId,
      title: parsed.title,
      summary: parsed.summary,
      displayOrder: nextOrder,
    })
    .returning({ id: modulesT.id });
  if (!inserted) throw new Error('INSERT_FAILED');

  await db.insert(activityLog).values({
    workspaceId: ws.id,
    userId: user.id,
    kind: 'module_created',
    payload: { weekId: parsed.weekId, title: parsed.title },
  });

  await writeAudit({
    workspaceId: ws.id,
    actorUserId: user.id,
    actorRole: ctx.role,
    action: 'module.create',
    resourceType: 'module',
    resourceId: inserted.id,
    before: null,
    after: { id: inserted.id, weekId: parsed.weekId, title: parsed.title },
  });

  revalidatePath(`/w/${ws.slug}/learn`);
  return { id: inserted.id };
}

const moduleDeleteInput = z.object({
  workspaceSlug: z.string(),
  moduleId: z.string().uuid(),
});

export async function deleteModule(input: z.infer<typeof moduleDeleteInput>): Promise<void> {
  const parsed = moduleDeleteInput.parse(input);
  const { ws, user, ctx } = await resolveWorkspace(parsed.workspaceSlug, RBAC_LEVELS.OWNER);

  const beforeRows = await db
    .select({ id: modulesT.id, title: modulesT.title, weekId: modulesT.weekId })
    .from(modulesT)
    .where(and(eq(modulesT.id, parsed.moduleId), eq(modulesT.workspaceId, ws.id)))
    .limit(1);
  const before = beforeRows[0] ?? null;

  await db
    .delete(modulesT)
    .where(and(eq(modulesT.id, parsed.moduleId), eq(modulesT.workspaceId, ws.id)));
  await db.insert(activityLog).values({
    workspaceId: ws.id,
    userId: user.id,
    kind: 'module_deleted',
    payload: { moduleId: parsed.moduleId },
  });
  await writeAudit({
    workspaceId: ws.id,
    actorUserId: user.id,
    actorRole: ctx.role,
    action: 'module.delete',
    resourceType: 'module',
    resourceId: parsed.moduleId,
    before,
    after: null,
  });
  revalidatePath(`/w/${ws.slug}/learn`);
}

/* ============================ Lessons ============================ */
const lessonInput = z.object({
  workspaceSlug: z.string(),
  moduleId: z.string().uuid(),
  title: z.string().min(1).max(200),
  slug: z.string().min(1).max(80).optional(),
  introMd: z.string().max(8000).optional(),
  estMinutes: z.number().int().min(1).max(240).optional(),
});

export async function createLesson(input: z.infer<typeof lessonInput>): Promise<{ id: string; slug: string }> {
  const parsed = lessonInput.parse(input);
  const { ws, user, ctx } = await resolveWorkspace(parsed.workspaceSlug, RBAC_LEVELS.EDITOR);
  await assertModuleInWorkspace(ws.id, parsed.moduleId);

  // Auto-slugify if not provided; ensure unique within workspace by appending counter
  const baseSlug = parsed.slug ? toSlug(parsed.slug) : toSlug(parsed.title);
  let slug = baseSlug;
  let counter = 2;
  while (true) {
    const existing = await db
      .select({ id: lessonsT.id })
      .from(lessonsT)
      .where(and(eq(lessonsT.workspaceId, ws.id), eq(lessonsT.slug, slug)))
      .limit(1);
    if (!existing[0]) break;
    slug = `${baseSlug}-${counter++}`;
  }

  const [{ next } = { next: 0 }] = await db
    .select({ next: drizzleMax(lessonsT.displayOrder) })
    .from(lessonsT)
    .where(eq(lessonsT.moduleId, parsed.moduleId));
  const nextOrder = (next ?? -1) + 1;

  const [inserted] = await db
    .insert(lessonsT)
    .values({
      workspaceId: ws.id,
      moduleId: parsed.moduleId,
      slug,
      title: parsed.title,
      introMd: parsed.introMd,
      estMinutes: parsed.estMinutes ?? 8,
      displayOrder: nextOrder,
    })
    .returning({ id: lessonsT.id, slug: lessonsT.slug });
  if (!inserted) throw new Error('INSERT_FAILED');

  await db.insert(activityLog).values({
    workspaceId: ws.id,
    userId: user.id,
    kind: 'lesson_created',
    payload: { moduleId: parsed.moduleId, title: parsed.title, slug },
  });

  await writeAudit({
    workspaceId: ws.id,
    actorUserId: user.id,
    actorRole: ctx.role,
    action: 'lesson.create',
    resourceType: 'lesson',
    resourceId: inserted.id,
    before: null,
    after: {
      id: inserted.id,
      moduleId: parsed.moduleId,
      slug: inserted.slug,
      title: parsed.title,
    },
  });

  revalidatePath(`/w/${ws.slug}/learn`);
  return { id: inserted.id, slug: inserted.slug };
}

const lessonDeleteInput = z.object({
  workspaceSlug: z.string(),
  lessonId: z.string().uuid(),
});

export async function deleteLesson(input: z.infer<typeof lessonDeleteInput>): Promise<void> {
  const parsed = lessonDeleteInput.parse(input);
  const { ws, user, ctx } = await resolveWorkspace(parsed.workspaceSlug, RBAC_LEVELS.OWNER);

  const beforeRows = await db
    .select({ id: lessonsT.id, title: lessonsT.title, slug: lessonsT.slug, moduleId: lessonsT.moduleId })
    .from(lessonsT)
    .where(and(eq(lessonsT.id, parsed.lessonId), eq(lessonsT.workspaceId, ws.id)))
    .limit(1);
  const before = beforeRows[0] ?? null;

  await db
    .delete(lessonsT)
    .where(and(eq(lessonsT.id, parsed.lessonId), eq(lessonsT.workspaceId, ws.id)));
  await db.insert(activityLog).values({
    workspaceId: ws.id,
    userId: user.id,
    kind: 'lesson_deleted',
    payload: { lessonId: parsed.lessonId },
  });
  await writeAudit({
    workspaceId: ws.id,
    actorUserId: user.id,
    actorRole: ctx.role,
    action: 'lesson.delete',
    resourceType: 'lesson',
    resourceId: parsed.lessonId,
    before,
    after: null,
  });
  revalidatePath(`/w/${ws.slug}/learn`);
}

/* ============================ Labs ============================ */
const labInput = z.object({
  workspaceSlug: z.string(),
  weekId: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  bodyMd: z.string().max(20000).optional(),
  estMinutes: z.number().int().min(1).max(480).optional(),
});

export async function createLab(input: z.infer<typeof labInput>): Promise<{ id: string }> {
  const parsed = labInput.parse(input);
  const { ws, user, ctx } = await resolveWorkspace(parsed.workspaceSlug, RBAC_LEVELS.EDITOR);
  await assertWeekInWorkspace(ws.id, parsed.weekId);

  const [{ next } = { next: 0 }] = await db
    .select({ next: drizzleMax(labsT.displayOrder) })
    .from(labsT)
    .where(eq(labsT.weekId, parsed.weekId));
  const nextOrder = (next ?? -1) + 1;

  const [inserted] = await db
    .insert(labsT)
    .values({
      workspaceId: ws.id,
      weekId: parsed.weekId,
      title: parsed.title,
      description: parsed.description,
      bodyMd: parsed.bodyMd,
      estMinutes: parsed.estMinutes ?? 30,
      displayOrder: nextOrder,
    })
    .returning({ id: labsT.id });
  if (!inserted) throw new Error('INSERT_FAILED');

  await db.insert(activityLog).values({
    workspaceId: ws.id,
    userId: user.id,
    kind: 'lab_created',
    payload: { weekId: parsed.weekId, title: parsed.title },
  });

  await writeAudit({
    workspaceId: ws.id,
    actorUserId: user.id,
    actorRole: ctx.role,
    action: 'lab.create',
    resourceType: 'lab',
    resourceId: inserted.id,
    before: null,
    after: { id: inserted.id, weekId: parsed.weekId, title: parsed.title },
  });

  revalidatePath(`/w/${ws.slug}/learn`);
  return { id: inserted.id };
}

const labDeleteInput = z.object({
  workspaceSlug: z.string(),
  labId: z.string().uuid(),
});

export async function deleteLab(input: z.infer<typeof labDeleteInput>): Promise<void> {
  const parsed = labDeleteInput.parse(input);
  const { ws, user, ctx } = await resolveWorkspace(parsed.workspaceSlug, RBAC_LEVELS.OWNER);

  const beforeRows = await db
    .select({ id: labsT.id, title: labsT.title, weekId: labsT.weekId })
    .from(labsT)
    .where(and(eq(labsT.id, parsed.labId), eq(labsT.workspaceId, ws.id)))
    .limit(1);
  const before = beforeRows[0] ?? null;

  await db.delete(labsT).where(and(eq(labsT.id, parsed.labId), eq(labsT.workspaceId, ws.id)));
  await db.insert(activityLog).values({
    workspaceId: ws.id,
    userId: user.id,
    kind: 'lab_deleted',
    payload: { labId: parsed.labId },
  });
  await writeAudit({
    workspaceId: ws.id,
    actorUserId: user.id,
    actorRole: ctx.role,
    action: 'lab.delete',
    resourceType: 'lab',
    resourceId: parsed.labId,
    before,
    after: null,
  });
  revalidatePath(`/w/${ws.slug}/learn`);
}
