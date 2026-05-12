/**
 * Node comments server actions.
 *
 * Per-node threaded discussion. RBAC:
 *   - Read   : LEARNER (20) — workspace members can read.
 *   - Write  : LEARNER (20) — any member can post.
 *   - Delete : author OR EDITOR+ (60).
 *
 * Replies are created by passing `parentCommentId`; we then enqueue a
 * `comment.reply` notification for the parent comment's author (skipped when
 * the author replies to themselves).
 *
 * Each mutation goes through `resolveWorkspace` (auth + RBAC + workspace
 * lookup) and writes an audit row. We use WORKSPACE_NOT_FOUND_OR_FORBIDDEN for
 * non-members to avoid leaking workspace existence.
 */
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { and, asc, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import {
  workspaces,
  roadmapTreeNodes,
  nodeComments,
  notifications,
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

async function assertNodeInWorkspace(workspaceId: string, nodeId: string) {
  const r = await db
    .select({ id: roadmapTreeNodes.id })
    .from(roadmapTreeNodes)
    .where(
      and(
        eq(roadmapTreeNodes.id, nodeId),
        eq(roadmapTreeNodes.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  if (!r[0]) throw new Error('NODE_NOT_FOUND');
}

/* ============================ types ============================ */

export type CommentRow = {
  id: string;
  workspaceId: string;
  nodeId: string;
  authorUserId: string;
  parentCommentId: string | null;
  body: string;
  createdAt: Date;
  updatedAt: Date;
};

/* ============================ Read ============================ */

export async function listComments(
  workspaceSlug: string,
  nodeId: string,
): Promise<CommentRow[]> {
  const { ws } = await resolveWorkspace(workspaceSlug, RBAC_LEVELS.LEARNER);
  await assertNodeInWorkspace(ws.id, nodeId);

  const rows = await db
    .select()
    .from(nodeComments)
    .where(
      and(
        eq(nodeComments.workspaceId, ws.id),
        eq(nodeComments.nodeId, nodeId),
      ),
    )
    .orderBy(asc(nodeComments.createdAt), asc(nodeComments.id));

  return rows.map((r) => ({
    id: r.id,
    workspaceId: r.workspaceId,
    nodeId: r.nodeId,
    authorUserId: r.authorUserId,
    parentCommentId: r.parentCommentId,
    body: r.body,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
}

/* ============================ Create ============================ */

const addInput = z.object({
  workspaceSlug: z.string(),
  nodeId: z.string().uuid(),
  body: z.string().min(1).max(5000),
  parentCommentId: z.string().uuid().optional(),
});

export async function addComment(
  input: z.infer<typeof addInput>,
): Promise<{ id: string }> {
  const parsed = addInput.parse(input);
  const { ws, user, ctx } = await resolveWorkspace(
    parsed.workspaceSlug,
    RBAC_LEVELS.LEARNER,
  );
  await assertNodeInWorkspace(ws.id, parsed.nodeId);

  // If replying, verify the parent comment exists in the same workspace and
  // capture its author so we can enqueue a notification.
  let parentAuthorUserId: string | null = null;
  if (parsed.parentCommentId) {
    const parentRows = await db
      .select({
        id: nodeComments.id,
        authorUserId: nodeComments.authorUserId,
        workspaceId: nodeComments.workspaceId,
      })
      .from(nodeComments)
      .where(eq(nodeComments.id, parsed.parentCommentId))
      .limit(1);
    const parent = parentRows[0];
    if (!parent || parent.workspaceId !== ws.id) {
      throw new Error('PARENT_COMMENT_NOT_FOUND');
    }
    parentAuthorUserId = parent.authorUserId;
  }

  const [inserted] = await db
    .insert(nodeComments)
    .values({
      workspaceId: ws.id,
      nodeId: parsed.nodeId,
      authorUserId: user.id,
      parentCommentId: parsed.parentCommentId ?? null,
      body: parsed.body,
    })
    .returning({ id: nodeComments.id });
  if (!inserted) throw new Error('INSERT_FAILED');

  // Notify parent author (skip self-replies — avoid notification noise).
  if (parentAuthorUserId && parentAuthorUserId !== user.id) {
    try {
      await db.insert(notifications).values({
        recipientUserId: parentAuthorUserId,
        kind: 'comment.reply',
        workspaceId: ws.id,
        resourceType: 'comment',
        resourceId: inserted.id,
        title: 'Có người trả lời bình luận của bạn',
        body: parsed.body.slice(0, 200),
      });
    } catch (err) {
      // Notification failure must not roll back the comment.
      console.error('[comments.addComment] notification failed:', err);
    }
  }

  await db.insert(activityLog).values({
    workspaceId: ws.id,
    userId: user.id,
    kind: 'comment_added',
    payload: {
      commentId: inserted.id,
      nodeId: parsed.nodeId,
      parentCommentId: parsed.parentCommentId ?? null,
    },
  });

  await writeAudit({
    workspaceId: ws.id,
    actorUserId: user.id,
    actorRole: ctx.role,
    action: 'comment.add',
    resourceType: 'comment',
    resourceId: inserted.id,
    after: {
      id: inserted.id,
      nodeId: parsed.nodeId,
      parentCommentId: parsed.parentCommentId ?? null,
      body: parsed.body,
    },
  });

  revalidatePath(`/w/${ws.slug}`);
  return { id: inserted.id };
}

/* ============================ Delete ============================ */

const deleteInput = z.object({
  workspaceSlug: z.string(),
  commentId: z.string().uuid(),
});

export async function deleteComment(
  input: z.infer<typeof deleteInput>,
): Promise<void> {
  const parsed = deleteInput.parse(input);
  const { ws, user, ctx } = await resolveWorkspace(
    parsed.workspaceSlug,
    RBAC_LEVELS.LEARNER,
  );

  const beforeRows = await db
    .select()
    .from(nodeComments)
    .where(
      and(
        eq(nodeComments.id, parsed.commentId),
        eq(nodeComments.workspaceId, ws.id),
      ),
    )
    .limit(1);
  const before = beforeRows[0];
  if (!before) throw new Error('COMMENT_NOT_FOUND');

  const isAuthor = before.authorUserId === user.id;
  const isEditor = ctx.level >= RBAC_LEVELS.EDITOR;
  if (!isAuthor && !isEditor) {
    throw new Error('FORBIDDEN');
  }

  // Tenant-scoped WHERE rejects cross-workspace TOCTOU.
  await db
    .delete(nodeComments)
    .where(
      and(
        eq(nodeComments.id, parsed.commentId),
        eq(nodeComments.workspaceId, ws.id),
      ),
    );

  await db.insert(activityLog).values({
    workspaceId: ws.id,
    userId: user.id,
    kind: 'comment_deleted',
    payload: { commentId: parsed.commentId, nodeId: before.nodeId },
  });

  await writeAudit({
    workspaceId: ws.id,
    actorUserId: user.id,
    actorRole: ctx.role,
    action: 'comment.delete',
    resourceType: 'comment',
    resourceId: parsed.commentId,
    before: {
      authorUserId: before.authorUserId,
      body: before.body,
      parentCommentId: before.parentCommentId,
    },
    after: null,
  });

  revalidatePath(`/w/${ws.slug}`);
}
