/**
 * Workspace follow / unfollow server actions.
 *
 * A logged-in user can follow any workspace whose slug they can reach (in
 * practice: public-readonly workspaces shared via /share/<slug>). Follows are
 * idempotent — duplicate calls skip silently.
 *
 * Audit goes to audit_log with `workspaceId` so the owner's audit feed shows
 * who's following. There is no RBAC level check beyond "logged in" — anyone
 * with the link can follow.
 */
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { and, eq, desc } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import {
  workspaces,
  workspaceFollows,
  notifications,
  activityLog,
} from '@/lib/db/schema';
import { requireUser } from '@/lib/auth/supabase-server';
import { writeAudit } from '@/lib/rbac/server';

/* ============================ helpers ============================ */

async function loadWorkspaceBySlug(slug: string) {
  const rows = await db
    .select({
      id: workspaces.id,
      slug: workspaces.slug,
      name: workspaces.name,
      ownerUserId: workspaces.ownerUserId,
    })
    .from(workspaces)
    .where(eq(workspaces.slug, slug))
    .limit(1);
  const ws = rows[0];
  if (!ws) throw new Error('WORKSPACE_NOT_FOUND');
  return ws;
}

/* ============================ Follow ============================ */

const followInput = z.string().min(1).max(200);

export async function followWorkspace(
  workspaceSlug: string,
): Promise<{ followed: boolean }> {
  const slug = followInput.parse(workspaceSlug);
  const user = await requireUser();
  const ws = await loadWorkspaceBySlug(slug);

  // Idempotent: short-circuit if a follow row already exists.
  const existing = await db
    .select({ id: workspaceFollows.id })
    .from(workspaceFollows)
    .where(
      and(
        eq(workspaceFollows.userId, user.id),
        eq(workspaceFollows.workspaceId, ws.id),
      ),
    )
    .limit(1);
  if (existing[0]) {
    return { followed: true };
  }

  await db.insert(workspaceFollows).values({
    userId: user.id,
    workspaceId: ws.id,
  });

  // Notify the workspace owner — they care that someone followed. Skip when
  // the follower IS the owner (self-follow noise).
  if (ws.ownerUserId && ws.ownerUserId !== user.id) {
    try {
      await db.insert(notifications).values({
        recipientUserId: ws.ownerUserId,
        kind: 'follow.new',
        workspaceId: ws.id,
        resourceType: 'workspace',
        resourceId: ws.id,
        title: `Có người mới theo dõi "${ws.name}"`,
        body: `${user.id.slice(0, 8)} đã theo dõi roadmap của bạn.`,
      });
    } catch (err) {
      console.error('[follows.followWorkspace] notification failed:', err);
    }
  }

  await db.insert(activityLog).values({
    workspaceId: ws.id,
    userId: user.id,
    kind: 'follow_added',
    payload: { workspaceSlug: ws.slug },
  });

  await writeAudit({
    workspaceId: ws.id,
    actorUserId: user.id,
    actorRole: 'viewer',
    action: 'follow.add',
    resourceType: 'workspace_follow',
    resourceId: ws.id,
    after: { userId: user.id, workspaceId: ws.id },
  });

  revalidatePath(`/share/${ws.slug}`);
  return { followed: true };
}

/* ============================ Unfollow ============================ */

export async function unfollowWorkspace(
  workspaceSlug: string,
): Promise<{ followed: boolean }> {
  const slug = followInput.parse(workspaceSlug);
  const user = await requireUser();
  const ws = await loadWorkspaceBySlug(slug);

  // Author-only: tenant-scoped WHERE ensures we only delete this user's own row.
  await db
    .delete(workspaceFollows)
    .where(
      and(
        eq(workspaceFollows.userId, user.id),
        eq(workspaceFollows.workspaceId, ws.id),
      ),
    );

  await writeAudit({
    workspaceId: ws.id,
    actorUserId: user.id,
    actorRole: 'viewer',
    action: 'follow.remove',
    resourceType: 'workspace_follow',
    resourceId: ws.id,
    before: { userId: user.id, workspaceId: ws.id },
    after: null,
  });

  revalidatePath(`/share/${ws.slug}`);
  return { followed: false };
}

/* ============================ Read ============================ */

export type FollowedWorkspace = {
  workspaceId: string;
  slug: string;
  name: string;
  followedAt: Date;
};

export async function listMyFollowedWorkspaces(): Promise<FollowedWorkspace[]> {
  const user = await requireUser();
  const rows = await db
    .select({
      workspaceId: workspaces.id,
      slug: workspaces.slug,
      name: workspaces.name,
      followedAt: workspaceFollows.createdAt,
    })
    .from(workspaceFollows)
    .innerJoin(workspaces, eq(workspaceFollows.workspaceId, workspaces.id))
    .where(eq(workspaceFollows.userId, user.id))
    .orderBy(desc(workspaceFollows.createdAt));

  return rows.map((r) => ({
    workspaceId: r.workspaceId,
    slug: r.slug,
    name: r.name,
    followedAt: r.followedAt,
  }));
}

/** Server helper: is the current user following this workspace? */
export async function isFollowingWorkspace(
  workspaceId: string,
  userId: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: workspaceFollows.id })
    .from(workspaceFollows)
    .where(
      and(
        eq(workspaceFollows.userId, userId),
        eq(workspaceFollows.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  return !!rows[0];
}
