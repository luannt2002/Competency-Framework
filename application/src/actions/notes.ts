/**
 * Week notes server actions — per-week personal notes (L3 layer).
 */
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { workspaces, userWeekNotes, weeks, activityLog } from '@/lib/db/schema';
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

const addInput = z.object({
  workspaceSlug: z.string(),
  weekId: z.string().uuid(),
  bodyMd: z.string().min(1).max(10_000),
});

export async function addWeekNote(input: z.infer<typeof addInput>): Promise<{ id: string }> {
  const parsed = addInput.parse(input);
  // Personal notes are written by learners against own user_id.
  const { ws, user, ctx } = await resolveWorkspace(parsed.workspaceSlug, RBAC_LEVELS.LEARNER);

  // Verify week belongs to workspace
  const wk = await db
    .select({ id: weeks.id })
    .from(weeks)
    .where(and(eq(weeks.id, parsed.weekId), eq(weeks.workspaceId, ws.id)))
    .limit(1);
  if (!wk[0]) throw new Error('WEEK_NOT_FOUND');

  const [inserted] = await db
    .insert(userWeekNotes)
    .values({
      workspaceId: ws.id,
      userId: user.id,
      weekId: parsed.weekId,
      bodyMd: parsed.bodyMd,
    })
    .returning({ id: userWeekNotes.id });
  if (!inserted) throw new Error('INSERT_FAILED');

  await db.insert(activityLog).values({
    workspaceId: ws.id,
    userId: user.id,
    kind: 'week_note_added',
    payload: { weekId: parsed.weekId, length: parsed.bodyMd.length },
  });

  await writeAudit({
    workspaceId: ws.id,
    actorUserId: user.id,
    actorRole: ctx.role,
    action: 'week_note.create',
    resourceType: 'week_note',
    resourceId: inserted.id,
    before: null,
    after: { id: inserted.id, weekId: parsed.weekId, length: parsed.bodyMd.length },
  });

  revalidatePath(`/w/${ws.slug}/learn`);
  return { id: inserted.id };
}

const deleteInput = z.object({
  workspaceSlug: z.string(),
  noteId: z.string().uuid(),
});

export async function deleteWeekNote(input: z.infer<typeof deleteInput>): Promise<void> {
  const parsed = deleteInput.parse(input);
  // Users delete their OWN notes — LEARNER level is sufficient because the
  // tenant-scoped WHERE filters by userId.
  const { ws, user, ctx } = await resolveWorkspace(parsed.workspaceSlug, RBAC_LEVELS.LEARNER);

  const beforeRows = await db
    .select({ id: userWeekNotes.id, weekId: userWeekNotes.weekId, bodyMd: userWeekNotes.bodyMd })
    .from(userWeekNotes)
    .where(
      and(
        eq(userWeekNotes.id, parsed.noteId),
        eq(userWeekNotes.workspaceId, ws.id),
        eq(userWeekNotes.userId, user.id),
      ),
    )
    .limit(1);
  const before = beforeRows[0]
    ? { id: beforeRows[0].id, weekId: beforeRows[0].weekId, length: beforeRows[0].bodyMd.length }
    : null;

  await db
    .delete(userWeekNotes)
    .where(
      and(
        eq(userWeekNotes.id, parsed.noteId),
        eq(userWeekNotes.workspaceId, ws.id),
        eq(userWeekNotes.userId, user.id),
      ),
    );

  await writeAudit({
    workspaceId: ws.id,
    actorUserId: user.id,
    actorRole: ctx.role,
    action: 'week_note.delete',
    resourceType: 'week_note',
    resourceId: parsed.noteId,
    before,
    after: null,
  });

  revalidatePath(`/w/${ws.slug}/learn`);
}

export type WeekNote = {
  id: string;
  bodyMd: string;
  createdAt: Date | null;
};

export async function listWeekNotes(
  workspaceSlug: string,
  weekId: string,
): Promise<WeekNote[]> {
  const { ws, user } = await resolveWorkspace(workspaceSlug, RBAC_LEVELS.LEARNER);
  return db
    .select({
      id: userWeekNotes.id,
      bodyMd: userWeekNotes.bodyMd,
      createdAt: userWeekNotes.createdAt,
    })
    .from(userWeekNotes)
    .where(
      and(
        eq(userWeekNotes.workspaceId, ws.id),
        eq(userWeekNotes.userId, user.id),
        eq(userWeekNotes.weekId, weekId),
      ),
    )
    .orderBy(desc(userWeekNotes.createdAt));
}
