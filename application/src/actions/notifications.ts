/**
 * Notifications inbox server actions.
 *
 * Per-user inbox of activity items (comment replies, new followers, invites,
 * etc.). Recipient-keyed; no RBAC level check beyond "I am the recipient".
 *
 * Writers (other modules) insert into `notifications`. This file only reads
 * and toggles read state. The bell UI polls listMyNotifications every 60s.
 */
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { notifications, workspaces } from '@/lib/db/schema';
import { requireUser } from '@/lib/auth/supabase-server';

/* ============================ types ============================ */

export type NotificationItem = {
  id: string;
  kind: string;
  workspaceId: string | null;
  workspaceSlug: string | null;
  resourceType: string | null;
  resourceId: string | null;
  title: string;
  body: string | null;
  readAt: Date | null;
  createdAt: Date;
};

/* ============================ Read ============================ */

const limitSchema = z.number().int().min(1).max(100).default(20);

export async function listMyNotifications(
  limit?: number,
): Promise<NotificationItem[]> {
  const user = await requireUser();
  const n = limitSchema.parse(limit ?? 20);

  // Left-join workspaces so we can surface a slug for navigation.
  const rows = await db
    .select({
      id: notifications.id,
      kind: notifications.kind,
      workspaceId: notifications.workspaceId,
      resourceType: notifications.resourceType,
      resourceId: notifications.resourceId,
      title: notifications.title,
      body: notifications.body,
      readAt: notifications.readAt,
      createdAt: notifications.createdAt,
      workspaceSlug: workspaces.slug,
    })
    .from(notifications)
    .leftJoin(workspaces, eq(notifications.workspaceId, workspaces.id))
    .where(eq(notifications.recipientUserId, user.id))
    // Match the index ordering: unread (read_at IS NULL) sorts first via
    // NULLS FIRST, then newest first inside each group.
    .orderBy(asc(notifications.readAt), desc(notifications.createdAt))
    .limit(n);

  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    workspaceId: r.workspaceId,
    workspaceSlug: r.workspaceSlug,
    resourceType: r.resourceType,
    resourceId: r.resourceId,
    title: r.title,
    body: r.body,
    readAt: r.readAt,
    createdAt: r.createdAt,
  }));
}

export async function countMyUnreadNotifications(): Promise<number> {
  const user = await requireUser();
  const rows = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(notifications)
    .where(
      and(
        eq(notifications.recipientUserId, user.id),
        isNull(notifications.readAt),
      ),
    );
  return rows[0]?.c ?? 0;
}

/* ============================ Mutations ============================ */

export async function markAllRead(): Promise<{ updated: number }> {
  const user = await requireUser();
  const now = new Date();
  const result = await db
    .update(notifications)
    .set({ readAt: now })
    .where(
      and(
        eq(notifications.recipientUserId, user.id),
        isNull(notifications.readAt),
      ),
    );
  // postgres.js returns an object with rowCount; Drizzle exposes it inconsistently
  // across drivers. We don't strictly need the count for correctness, just
  // return 0 when unavailable.
  const updated =
    typeof (result as unknown as { count?: number }).count === 'number'
      ? (result as unknown as { count: number }).count
      : 0;
  revalidatePath('/');
  return { updated };
}

const markReadInput = z.string().uuid();

export async function markRead(notificationId: string): Promise<void> {
  const id = markReadInput.parse(notificationId);
  const user = await requireUser();

  // Tenant-style scope: verify recipient before update so a forged id can't
  // touch someone else's row. We update with a recipient-scoped WHERE so even
  // a TOCTOU race can't escape the constraint.
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.id, id),
        eq(notifications.recipientUserId, user.id),
      ),
    );
  revalidatePath('/');
}
