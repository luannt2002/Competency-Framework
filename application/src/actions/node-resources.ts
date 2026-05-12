/**
 * Node resource-library server actions.
 *
 * Each tree node may collect curated learning resources (link / video / doc /
 * book) shared by members. Reads are LEARNER-level; adds are LEARNER-level
 * (members of the workspace can contribute); removes require either the
 * original adder or EDITOR+.
 *
 * Every mutation goes through `resolveWorkspace` (auth + RBAC + workspace
 * lookup) and writes an audit row. The same WORKSPACE_NOT_FOUND_OR_FORBIDDEN
 * shape is used for non-members so we don't leak workspace existence.
 */
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { and, asc, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import {
  workspaces,
  roadmapTreeNodes,
  nodeResources,
  activityLog,
  RESOURCE_KINDS,
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
      and(
        eq(roadmapTreeNodes.id, nodeId),
        eq(roadmapTreeNodes.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  if (!r[0]) throw new Error('NODE_NOT_FOUND');
}

/* ============================ types ============================ */

export type NodeResourceRow = {
  id: string;
  workspaceId: string;
  nodeId: string;
  kind: 'link' | 'video' | 'doc' | 'book';
  title: string;
  url: string;
  description: string | null;
  createdAt: Date;
  addedByUserId: string | null;
};

/* ============================ Read ============================ */

export async function listResources(
  workspaceSlug: string,
  nodeId: string,
): Promise<NodeResourceRow[]> {
  const { ws } = await resolveWorkspace(workspaceSlug, RBAC_LEVELS.LEARNER);
  await assertNodeInWorkspace(ws.id, nodeId);

  const rows = await db
    .select()
    .from(nodeResources)
    .where(
      and(
        eq(nodeResources.workspaceId, ws.id),
        eq(nodeResources.nodeId, nodeId),
      ),
    )
    .orderBy(asc(nodeResources.createdAt));

  return rows.map((r) => ({
    id: r.id,
    workspaceId: r.workspaceId,
    nodeId: r.nodeId,
    kind: r.kind as 'link' | 'video' | 'doc' | 'book',
    title: r.title,
    url: r.url,
    description: r.description,
    createdAt: r.createdAt,
    addedByUserId: r.addedByUserId,
  }));
}

/* ============================ Add ============================ */

const addInput = z.object({
  workspaceSlug: z.string(),
  nodeId: z.string().uuid(),
  kind: z.enum(RESOURCE_KINDS),
  title: z.string().min(1).max(200),
  // Bound length so a URL field can't be abused as a body field.
  url: z.string().min(1).max(2000).url(),
  description: z.string().max(2000).optional(),
});

export async function addNodeResource(
  input: z.infer<typeof addInput>,
): Promise<{ id: string }> {
  const parsed = addInput.parse(input);
  const { ws, user, ctx } = await resolveWorkspace(
    parsed.workspaceSlug,
    RBAC_LEVELS.LEARNER,
  );
  await assertNodeInWorkspace(ws.id, parsed.nodeId);

  const [inserted] = await db
    .insert(nodeResources)
    .values({
      workspaceId: ws.id,
      nodeId: parsed.nodeId,
      kind: parsed.kind,
      title: parsed.title,
      url: parsed.url,
      description: parsed.description ?? null,
      addedByUserId: user.id,
    })
    .returning({ id: nodeResources.id });
  if (!inserted) throw new Error('INSERT_FAILED');

  await db.insert(activityLog).values({
    workspaceId: ws.id,
    userId: user.id,
    kind: 'resource_added',
    payload: {
      resourceId: inserted.id,
      nodeId: parsed.nodeId,
      kind: parsed.kind,
      title: parsed.title,
    },
  });

  await writeAudit({
    workspaceId: ws.id,
    actorUserId: user.id,
    actorRole: ctx.role,
    action: 'resource.add',
    resourceType: 'node_resource',
    resourceId: inserted.id,
    after: {
      id: inserted.id,
      nodeId: parsed.nodeId,
      kind: parsed.kind,
      title: parsed.title,
      url: parsed.url,
    },
  });

  revalidatePath(`/w/${ws.slug}`);
  return { id: inserted.id };
}

/* ============================ Remove ============================ */

export async function removeNodeResource(input: {
  workspaceSlug: string;
  resourceId: string;
}): Promise<void> {
  const parsed = z
    .object({
      workspaceSlug: z.string(),
      resourceId: z.string().uuid(),
    })
    .parse(input);

  // Floor at LEARNER — adder check below upgrades the gate as needed.
  const { ws, user, ctx } = await resolveWorkspace(
    parsed.workspaceSlug,
    RBAC_LEVELS.LEARNER,
  );

  const beforeRows = await db
    .select()
    .from(nodeResources)
    .where(
      and(
        eq(nodeResources.id, parsed.resourceId),
        eq(nodeResources.workspaceId, ws.id),
      ),
    )
    .limit(1);
  const before = beforeRows[0];
  if (!before) throw new Error('RESOURCE_NOT_FOUND');

  // Adder can remove own; EDITOR+ can remove any.
  const isAuthor = before.addedByUserId === user.id;
  const isEditor = ctx.level >= RBAC_LEVELS.EDITOR;
  if (!isAuthor && !isEditor) {
    throw new Error('FORBIDDEN');
  }

  // Tenant-scoped WHERE rejects cross-workspace TOCTOU.
  await db
    .delete(nodeResources)
    .where(
      and(
        eq(nodeResources.id, parsed.resourceId),
        eq(nodeResources.workspaceId, ws.id),
      ),
    );

  await db.insert(activityLog).values({
    workspaceId: ws.id,
    userId: user.id,
    kind: 'resource_removed',
    payload: { resourceId: parsed.resourceId, nodeId: before.nodeId },
  });

  await writeAudit({
    workspaceId: ws.id,
    actorUserId: user.id,
    actorRole: ctx.role,
    action: 'resource.remove',
    resourceType: 'node_resource',
    resourceId: parsed.resourceId,
    before: {
      id: before.id,
      nodeId: before.nodeId,
      kind: before.kind,
      title: before.title,
      url: before.url,
      addedByUserId: before.addedByUserId,
    },
    after: null,
  });

  revalidatePath(`/w/${ws.slug}`);
}
