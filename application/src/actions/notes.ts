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

async function resolveWorkspace(slug: string, userId: string) {
  const rows = await db
    .select({ id: workspaces.id, slug: workspaces.slug })
    .from(workspaces)
    .where(and(eq(workspaces.slug, slug), eq(workspaces.ownerUserId, userId)))
    .limit(1);
  if (!rows[0]) throw new Error('WORKSPACE_NOT_FOUND_OR_FORBIDDEN');
  return rows[0];
}

const addInput = z.object({
  workspaceSlug: z.string(),
  weekId: z.string().uuid(),
  bodyMd: z.string().min(1).max(10_000),
});

export async function addWeekNote(input: z.infer<typeof addInput>): Promise<{ id: string }> {
  const user = await requireUser();
  const parsed = addInput.parse(input);
  const ws = await resolveWorkspace(parsed.workspaceSlug, user.id);

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

  revalidatePath(`/w/${ws.slug}/learn`);
  return { id: inserted.id };
}

const deleteInput = z.object({
  workspaceSlug: z.string(),
  noteId: z.string().uuid(),
});

export async function deleteWeekNote(input: z.infer<typeof deleteInput>): Promise<void> {
  const user = await requireUser();
  const parsed = deleteInput.parse(input);
  const ws = await resolveWorkspace(parsed.workspaceSlug, user.id);

  await db
    .delete(userWeekNotes)
    .where(
      and(
        eq(userWeekNotes.id, parsed.noteId),
        eq(userWeekNotes.workspaceId, ws.id),
        eq(userWeekNotes.userId, user.id),
      ),
    );
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
  const user = await requireUser();
  const ws = await resolveWorkspace(workspaceSlug, user.id);
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
