/**
 * Labs server actions — list labs per week + mark-as-done with evidence.
 * Labs are hands-on tasks (vs lessons = bite-sized study).
 */
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { labs, userLabProgress, workspaces, activityLog, xpEvents } from '@/lib/db/schema';
import { requireUser } from '@/lib/auth/supabase-server';
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

export type LabWithProgress = {
  id: string;
  title: string;
  description: string | null;
  bodyMd: string | null;
  estMinutes: number | null;
  status: string | null;
  evidenceUrls: string[] | null;
  note: string | null;
  completedAt: Date | null;
};

export async function listLabsForWeek(
  workspaceSlug: string,
  weekId: string,
): Promise<LabWithProgress[]> {
  const { ws, user } = await resolveWorkspace(workspaceSlug, RBAC_LEVELS.LEARNER);

  const rows = await db
    .select({
      id: labs.id,
      title: labs.title,
      description: labs.description,
      bodyMd: labs.bodyMd,
      estMinutes: labs.estMinutes,
      status: userLabProgress.status,
      evidenceUrls: userLabProgress.evidenceUrls,
      note: userLabProgress.note,
      completedAt: userLabProgress.completedAt,
    })
    .from(labs)
    .leftJoin(
      userLabProgress,
      and(eq(userLabProgress.labId, labs.id), eq(userLabProgress.userId, user.id)),
    )
    .where(and(eq(labs.workspaceId, ws.id), eq(labs.weekId, weekId)));

  return rows;
}

const completeInput = z.object({
  workspaceSlug: z.string(),
  labId: z.string().uuid(),
  evidenceUrls: z.array(z.string().url()).max(10).optional(),
  note: z.string().max(2_000).optional(),
});

export async function markLabDone(input: z.infer<typeof completeInput>): Promise<void> {
  const parsed = completeInput.parse(input);
  // Marking own progress = LEARNER (per spec).
  const { ws, user, ctx } = await resolveWorkspace(parsed.workspaceSlug, RBAC_LEVELS.LEARNER);

  // Verify lab belongs to workspace
  const labRows = await db
    .select({ id: labs.id })
    .from(labs)
    .where(and(eq(labs.id, parsed.labId), eq(labs.workspaceId, ws.id)))
    .limit(1);
  if (!labRows[0]) throw new Error('LAB_NOT_FOUND');

  const existing = await db
    .select({ id: userLabProgress.id, status: userLabProgress.status })
    .from(userLabProgress)
    .where(
      and(
        eq(userLabProgress.workspaceId, ws.id),
        eq(userLabProgress.userId, user.id),
        eq(userLabProgress.labId, parsed.labId),
      ),
    )
    .limit(1);

  const alreadyDone = existing[0]?.status === 'done';

  if (existing[0]) {
    await db
      .update(userLabProgress)
      .set({
        status: 'done',
        evidenceUrls: parsed.evidenceUrls ?? [],
        note: parsed.note,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(userLabProgress.id, existing[0].id));
  } else {
    await db.insert(userLabProgress).values({
      workspaceId: ws.id,
      userId: user.id,
      labId: parsed.labId,
      status: 'done',
      evidenceUrls: parsed.evidenceUrls ?? [],
      note: parsed.note,
      completedAt: new Date(),
    });
  }

  // Award XP first time done (50 XP per lab — substantial, labs are big)
  if (!alreadyDone) {
    await db.insert(xpEvents).values({
      workspaceId: ws.id,
      userId: user.id,
      amount: 50,
      reason: 'lab_complete',
      refKind: 'lab',
      refId: parsed.labId,
    });
  }

  await db.insert(activityLog).values({
    workspaceId: ws.id,
    userId: user.id,
    kind: 'lab_completed',
    payload: { labId: parsed.labId, evidenceCount: parsed.evidenceUrls?.length ?? 0 },
  });

  await writeAudit({
    workspaceId: ws.id,
    actorUserId: user.id,
    actorRole: ctx.role,
    action: 'lab.mark_done',
    resourceType: 'lab',
    resourceId: parsed.labId,
    before: { status: existing[0]?.status ?? 'todo' },
    after: {
      status: 'done',
      evidenceCount: parsed.evidenceUrls?.length ?? 0,
      note: parsed.note ?? null,
    },
  });

  revalidatePath(`/w/${ws.slug}/learn`);
}

export async function unmarkLab(workspaceSlug: string, labId: string): Promise<void> {
  const { ws, user, ctx } = await resolveWorkspace(workspaceSlug, RBAC_LEVELS.LEARNER);
  await db
    .update(userLabProgress)
    .set({ status: 'todo', completedAt: null, updatedAt: new Date() })
    .where(
      and(
        eq(userLabProgress.workspaceId, ws.id),
        eq(userLabProgress.userId, user.id),
        eq(userLabProgress.labId, labId),
      ),
    );
  await writeAudit({
    workspaceId: ws.id,
    actorUserId: user.id,
    actorRole: ctx.role,
    action: 'lab.unmark',
    resourceType: 'lab',
    resourceId: labId,
    before: { status: 'done' },
    after: { status: 'todo' },
  });
  revalidatePath(`/w/${ws.slug}/learn`);
}
