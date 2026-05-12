/**
 * Node Journal / Posts server actions.
 *
 * One tree node (Week / Session / Lesson / any) can have many journal entries
 * authored by different users — "1 buổi có nhiều bài post/blog/bài học/lab".
 *
 * RBAC model:
 *   - Read  : LEARNER (20) — members of the workspace can read all entries.
 *   - Write : LEARNER (20) — any member can author entries.
 *   - Edit  : author of the entry OR effective level >= EDITOR (60).
 *   - Delete: author of the entry OR effective level >= EDITOR (60).
 *
 * Each mutation goes through `resolveWorkspace` (auth + RBAC + workspace
 * lookup) and writes an audit row. The same WORKSPACE_NOT_FOUND_OR_FORBIDDEN
 * shape is used for non-members so we don't leak workspace existence.
 */
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { and, asc, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import {
  workspaces,
  roadmapTreeNodes,
  nodeJournalEntries,
  activityLog,
} from '@/lib/db/schema';
import { requireUser } from '@/lib/auth/supabase-server';
import { RBAC_LEVELS } from '@/lib/rbac/levels';
import { requireMinLevel, writeAudit, RBACError } from '@/lib/rbac/server';

/* ============================ helpers ============================ */

async function resolveWorkspace(slug: string, requiredLevel: number) {
  const user = await requireUser();

  const rows = await db
    .select({ id: workspaces.id, slug: workspaces.slug })
    .from(workspaces)
    .where(eq(workspaces.slug, slug))
    .limit(1);
  const ws = rows[0];
  if (!ws) throw new Error('WORKSPACE_NOT_FOUND_OR_FORBIDDEN');

  let ctx;
  try {
    ctx = await requireMinLevel(ws.id, requiredLevel);
  } catch (err) {
    if (err instanceof RBACError) {
      throw new Error('WORKSPACE_NOT_FOUND_OR_FORBIDDEN');
    }
    throw err;
  }

  return { ws, user, ctx };
}

/** Confirm the node belongs to the workspace (tenant-scoped guard). */
async function assertNodeInWorkspace(workspaceId: string, nodeId: string) {
  const r = await db
    .select({ id: roadmapTreeNodes.id })
    .from(roadmapTreeNodes)
    .where(
      and(eq(roadmapTreeNodes.id, nodeId), eq(roadmapTreeNodes.workspaceId, workspaceId)),
    )
    .limit(1);
  if (!r[0]) throw new Error('NODE_NOT_FOUND');
}

/* ============================ types ============================ */

export type JournalEntry = {
  id: string;
  workspaceId: string;
  nodeId: string;
  authorUserId: string;
  title: string;
  bodyMd: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
};

/* ============================ Read ============================ */

export async function listJournalEntries(
  workspaceSlug: string,
  nodeId: string,
): Promise<JournalEntry[]> {
  const { ws } = await resolveWorkspace(workspaceSlug, RBAC_LEVELS.LEARNER);
  await assertNodeInWorkspace(ws.id, nodeId);

  const rows = await db
    .select()
    .from(nodeJournalEntries)
    .where(
      and(
        eq(nodeJournalEntries.workspaceId, ws.id),
        eq(nodeJournalEntries.nodeId, nodeId),
      ),
    )
    .orderBy(desc(nodeJournalEntries.createdAt), asc(nodeJournalEntries.id));

  return rows.map((r) => ({
    id: r.id,
    workspaceId: r.workspaceId,
    nodeId: r.nodeId,
    authorUserId: r.authorUserId,
    title: r.title,
    bodyMd: r.bodyMd,
    tags: (r.tags as string[] | null) ?? [],
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
}

/* ============================ Create ============================ */

const createInput = z.object({
  workspaceSlug: z.string(),
  nodeId: z.string().uuid(),
  title: z.string().min(1).max(200),
  bodyMd: z.string().min(1).max(50000),
  tags: z.array(z.string().max(40)).max(20).optional(),
});

export async function createJournalEntry(
  input: z.infer<typeof createInput>,
): Promise<{ id: string }> {
  const parsed = createInput.parse(input);
  const { ws, user, ctx } = await resolveWorkspace(
    parsed.workspaceSlug,
    RBAC_LEVELS.LEARNER,
  );
  await assertNodeInWorkspace(ws.id, parsed.nodeId);

  const [inserted] = await db
    .insert(nodeJournalEntries)
    .values({
      workspaceId: ws.id,
      nodeId: parsed.nodeId,
      authorUserId: user.id,
      title: parsed.title,
      bodyMd: parsed.bodyMd,
      tags: parsed.tags ?? [],
    })
    .returning({ id: nodeJournalEntries.id });
  if (!inserted) throw new Error('INSERT_FAILED');

  await db.insert(activityLog).values({
    workspaceId: ws.id,
    userId: user.id,
    kind: 'journal_entry_created',
    payload: { entryId: inserted.id, nodeId: parsed.nodeId, title: parsed.title },
  });

  await writeAudit({
    workspaceId: ws.id,
    actorUserId: user.id,
    actorRole: ctx.role,
    action: 'journal_entry.create',
    resourceType: 'journal_entry',
    resourceId: inserted.id,
    after: {
      id: inserted.id,
      nodeId: parsed.nodeId,
      title: parsed.title,
      tags: parsed.tags ?? [],
    },
  });

  revalidatePath(`/w/${ws.slug}`);
  return { id: inserted.id };
}

/* ============================ Update ============================ */

const updateInput = z.object({
  workspaceSlug: z.string(),
  entryId: z.string().uuid(),
  title: z.string().min(1).max(200).optional(),
  bodyMd: z.string().min(1).max(50000).optional(),
  tags: z.array(z.string().max(40)).max(20).optional(),
});

export async function updateJournalEntry(
  input: z.infer<typeof updateInput>,
): Promise<void> {
  const parsed = updateInput.parse(input);
  // Floor at LEARNER — author check below upgrades the gate as needed.
  const { ws, user, ctx } = await resolveWorkspace(
    parsed.workspaceSlug,
    RBAC_LEVELS.LEARNER,
  );

  const beforeRows = await db
    .select()
    .from(nodeJournalEntries)
    .where(
      and(
        eq(nodeJournalEntries.id, parsed.entryId),
        eq(nodeJournalEntries.workspaceId, ws.id),
      ),
    )
    .limit(1);
  const before = beforeRows[0];
  if (!before) throw new Error('ENTRY_NOT_FOUND');

  // Author can edit own; EDITOR+ can edit any.
  const isAuthor = before.authorUserId === user.id;
  const isEditor = ctx.level >= RBAC_LEVELS.EDITOR;
  if (!isAuthor && !isEditor) {
    throw new Error('FORBIDDEN');
  }

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.title !== undefined) patch.title = parsed.title;
  if (parsed.bodyMd !== undefined) patch.bodyMd = parsed.bodyMd;
  if (parsed.tags !== undefined) patch.tags = parsed.tags;

  await db
    .update(nodeJournalEntries)
    .set(patch)
    .where(
      and(
        eq(nodeJournalEntries.id, parsed.entryId),
        eq(nodeJournalEntries.workspaceId, ws.id),
      ),
    );

  await db.insert(activityLog).values({
    workspaceId: ws.id,
    userId: user.id,
    kind: 'journal_entry_updated',
    payload: { entryId: parsed.entryId, nodeId: before.nodeId },
  });

  await writeAudit({
    workspaceId: ws.id,
    actorUserId: user.id,
    actorRole: ctx.role,
    action: 'journal_entry.update',
    resourceType: 'journal_entry',
    resourceId: parsed.entryId,
    before: {
      title: before.title,
      bodyMd: before.bodyMd,
      tags: before.tags,
    },
    after: {
      title: parsed.title,
      bodyMd: parsed.bodyMd,
      tags: parsed.tags,
    },
  });

  revalidatePath(`/w/${ws.slug}`);
}

/* ============================ Delete ============================ */

export async function deleteJournalEntry(input: {
  workspaceSlug: string;
  entryId: string;
}): Promise<void> {
  const parsed = z
    .object({
      workspaceSlug: z.string(),
      entryId: z.string().uuid(),
    })
    .parse(input);

  const { ws, user, ctx } = await resolveWorkspace(
    parsed.workspaceSlug,
    RBAC_LEVELS.LEARNER,
  );

  const beforeRows = await db
    .select()
    .from(nodeJournalEntries)
    .where(
      and(
        eq(nodeJournalEntries.id, parsed.entryId),
        eq(nodeJournalEntries.workspaceId, ws.id),
      ),
    )
    .limit(1);
  const before = beforeRows[0];
  if (!before) throw new Error('ENTRY_NOT_FOUND');

  const isAuthor = before.authorUserId === user.id;
  const isEditor = ctx.level >= RBAC_LEVELS.EDITOR;
  if (!isAuthor && !isEditor) {
    throw new Error('FORBIDDEN');
  }

  // Tenant-scoped WHERE rejects cross-workspace TOCTOU.
  await db
    .delete(nodeJournalEntries)
    .where(
      and(
        eq(nodeJournalEntries.id, parsed.entryId),
        eq(nodeJournalEntries.workspaceId, ws.id),
      ),
    );

  await db.insert(activityLog).values({
    workspaceId: ws.id,
    userId: user.id,
    kind: 'journal_entry_deleted',
    payload: { entryId: parsed.entryId, nodeId: before.nodeId },
  });

  await writeAudit({
    workspaceId: ws.id,
    actorUserId: user.id,
    actorRole: ctx.role,
    action: 'journal_entry.delete',
    resourceType: 'journal_entry',
    resourceId: parsed.entryId,
    before: {
      title: before.title,
      bodyMd: before.bodyMd,
      tags: before.tags,
      authorUserId: before.authorUserId,
    },
    after: null,
  });

  revalidatePath(`/w/${ws.slug}`);
}
