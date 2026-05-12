/**
 * Flexible roadmap tree — N-depth node CRUD + reorder.
 * Each node has parent_id, order_index. User-defined node types.
 */
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { eq, and, max as drizzleMax, asc, sql as dsql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import {
  workspaces,
  roadmapTreeNodes,
  userNodeProgress,
  activityLog,
} from '@/lib/db/schema';
import { requireUser } from '@/lib/auth/supabase-server';
import { toSlug } from '@/lib/utils';
import { RBAC_LEVELS } from '@/lib/rbac/levels';
import { requireMinLevel, writeAudit, RBACError } from '@/lib/rbac/server';

/**
 * Resolve a workspace by slug, then enforce the RBAC level needed for the
 * caller's action. Replaces the old (slug, userId) owner-only check.
 *
 * Returns 404-style error (WORKSPACE_NOT_FOUND_OR_FORBIDDEN) when the slug
 * doesn't exist OR the user lacks the level — same response in both cases
 * to avoid leaking workspace existence to non-members.
 */
async function resolveWorkspace(slug: string, requiredLevel: number) {
  // Auth gate first — every mutation must be logged in.
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

export type TreeNode = {
  id: string;
  parentId: string | null;
  nodeType: string;
  title: string;
  slug: string;
  description: string | null;
  bodyMd: string | null;
  orderIndex: number;
  estMinutes: number | null;
  meta: Record<string, unknown>;
  pathStr: string;
  depth: number;
};

export type TreeNodeWithChildren = TreeNode & {
  children: TreeNodeWithChildren[];
  progress?: { status: string; completedAt: Date | null } | null;
};

/* ============================ Reads ============================ */
export async function listTreeForWorkspace(workspaceSlug: string): Promise<TreeNodeWithChildren[]> {
  // Reads only require LEARNER (20); viewers/guests fall through to
  // WORKSPACE_NOT_FOUND_OR_FORBIDDEN. This keeps the per-user progress join
  // from leaking against an anonymous user.
  const { ws, user } = await resolveWorkspace(workspaceSlug, RBAC_LEVELS.LEARNER);

  const rows = await db
    .select()
    .from(roadmapTreeNodes)
    .where(eq(roadmapTreeNodes.workspaceId, ws.id))
    .orderBy(asc(roadmapTreeNodes.depth), asc(roadmapTreeNodes.orderIndex));

  const progress = await db
    .select()
    .from(userNodeProgress)
    .where(
      and(eq(userNodeProgress.workspaceId, ws.id), eq(userNodeProgress.userId, user.id)),
    );
  const progressMap = new Map(progress.map((p) => [p.nodeId, p]));

  // Build tree
  const byId = new Map<string, TreeNodeWithChildren>();
  const roots: TreeNodeWithChildren[] = [];

  for (const r of rows) {
    const node: TreeNodeWithChildren = {
      id: r.id,
      parentId: r.parentId,
      nodeType: r.nodeType,
      title: r.title,
      slug: r.slug,
      description: r.description,
      bodyMd: r.bodyMd,
      orderIndex: r.orderIndex,
      estMinutes: r.estMinutes,
      meta: (r.meta as Record<string, unknown>) ?? {},
      pathStr: r.pathStr,
      depth: r.depth,
      children: [],
      progress: progressMap.get(r.id)
        ? {
            status: progressMap.get(r.id)!.status ?? 'todo',
            completedAt: progressMap.get(r.id)!.completedAt,
          }
        : null,
    };
    byId.set(r.id, node);
  }

  for (const node of byId.values()) {
    if (node.parentId) {
      const parent = byId.get(node.parentId);
      if (parent) parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // Sort children by orderIndex
  const sortRecursive = (nodes: TreeNodeWithChildren[]) => {
    nodes.sort((a, b) => a.orderIndex - b.orderIndex);
    for (const n of nodes) sortRecursive(n.children);
  };
  sortRecursive(roots);

  return roots;
}

/* ============================ Create ============================ */
const createInput = z.object({
  workspaceSlug: z.string(),
  parentId: z.string().uuid().nullable(),
  nodeType: z.string().min(1).max(40),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  bodyMd: z.string().max(50000).optional(),
  estMinutes: z.number().int().min(0).max(10000).optional(),
});

export async function createTreeNode(input: z.infer<typeof createInput>): Promise<{ id: string; slug: string }> {
  const parsed = createInput.parse(input);
  const { ws, user, ctx } = await resolveWorkspace(parsed.workspaceSlug, RBAC_LEVELS.EDITOR);

  // Compute slug + ensure unique within workspace
  let baseSlug = toSlug(parsed.title);
  if (!baseSlug) baseSlug = `node-${Date.now()}`;
  let slug = baseSlug;
  let counter = 2;
  while (true) {
    const existing = await db
      .select({ id: roadmapTreeNodes.id })
      .from(roadmapTreeNodes)
      .where(and(eq(roadmapTreeNodes.workspaceId, ws.id), eq(roadmapTreeNodes.slug, slug)))
      .limit(1);
    if (!existing[0]) break;
    slug = `${baseSlug}-${counter++}`;
  }

  // Compute next orderIndex among siblings
  const siblingCondition = parsed.parentId
    ? and(
        eq(roadmapTreeNodes.workspaceId, ws.id),
        eq(roadmapTreeNodes.parentId, parsed.parentId),
      )
    : and(
        eq(roadmapTreeNodes.workspaceId, ws.id),
        dsql`${roadmapTreeNodes.parentId} IS NULL`,
      );
  const [{ next } = { next: 0 }] = await db
    .select({ next: drizzleMax(roadmapTreeNodes.orderIndex) })
    .from(roadmapTreeNodes)
    .where(siblingCondition);
  const orderIndex = (next ?? -1) + 1;

  // Compute path + depth
  let pathStr = '';
  let depth = 0;
  if (parsed.parentId) {
    const parent = await db
      .select({ pathStr: roadmapTreeNodes.pathStr, depth: roadmapTreeNodes.depth })
      .from(roadmapTreeNodes)
      .where(eq(roadmapTreeNodes.id, parsed.parentId))
      .limit(1);
    if (!parent[0]) throw new Error('PARENT_NOT_FOUND');
    pathStr = parent[0].pathStr ? `${parent[0].pathStr}/${parsed.parentId}` : parsed.parentId;
    depth = (parent[0].depth ?? 0) + 1;
  }

  const [inserted] = await db
    .insert(roadmapTreeNodes)
    .values({
      workspaceId: ws.id,
      parentId: parsed.parentId,
      nodeType: parsed.nodeType,
      title: parsed.title,
      slug,
      description: parsed.description,
      bodyMd: parsed.bodyMd,
      orderIndex,
      estMinutes: parsed.estMinutes,
      pathStr,
      depth,
      meta: {},
    })
    .returning({ id: roadmapTreeNodes.id, slug: roadmapTreeNodes.slug });
  if (!inserted) throw new Error('INSERT_FAILED');

  await db.insert(activityLog).values({
    workspaceId: ws.id,
    userId: user.id,
    kind: 'tree_node_created',
    payload: { nodeId: inserted.id, parentId: parsed.parentId, type: parsed.nodeType, title: parsed.title },
  });

  await writeAudit({
    workspaceId: ws.id,
    actorUserId: user.id,
    actorRole: ctx.role,
    action: 'tree_node.create',
    resourceType: 'tree_node',
    resourceId: inserted.id,
    after: {
      id: inserted.id,
      slug: inserted.slug,
      title: parsed.title,
      parentId: parsed.parentId,
      nodeType: parsed.nodeType,
    },
  });

  revalidatePath(`/w/${ws.slug}`);
  return { id: inserted.id, slug: inserted.slug };
}

/* ============================ Update ============================ */
const updateInput = z.object({
  workspaceSlug: z.string(),
  nodeId: z.string().uuid(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  bodyMd: z.string().max(50000).optional(),
  nodeType: z.string().min(1).max(40).optional(),
  estMinutes: z.number().int().min(0).max(10000).optional(),
});

export async function updateTreeNode(input: z.infer<typeof updateInput>): Promise<void> {
  const parsed = updateInput.parse(input);
  const { ws, user, ctx } = await resolveWorkspace(parsed.workspaceSlug, RBAC_LEVELS.EDITOR);

  // Capture before-state for audit. Single round-trip; the subsequent UPDATE
  // uses a tenant-scoped WHERE so a TOCTOU swap of nodeId across workspaces
  // is rejected at the DB layer.
  const beforeRows = await db
    .select({
      title: roadmapTreeNodes.title,
      description: roadmapTreeNodes.description,
      bodyMd: roadmapTreeNodes.bodyMd,
      nodeType: roadmapTreeNodes.nodeType,
      estMinutes: roadmapTreeNodes.estMinutes,
    })
    .from(roadmapTreeNodes)
    .where(and(eq(roadmapTreeNodes.id, parsed.nodeId), eq(roadmapTreeNodes.workspaceId, ws.id)))
    .limit(1);
  const before = beforeRows[0] ?? null;

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.title !== undefined) patch.title = parsed.title;
  if (parsed.description !== undefined) patch.description = parsed.description;
  if (parsed.bodyMd !== undefined) patch.bodyMd = parsed.bodyMd;
  if (parsed.nodeType !== undefined) patch.nodeType = parsed.nodeType;
  if (parsed.estMinutes !== undefined) patch.estMinutes = parsed.estMinutes;

  await db
    .update(roadmapTreeNodes)
    .set(patch)
    .where(and(eq(roadmapTreeNodes.id, parsed.nodeId), eq(roadmapTreeNodes.workspaceId, ws.id)));

  await db.insert(activityLog).values({
    workspaceId: ws.id,
    userId: user.id,
    kind: 'tree_node_updated',
    payload: { nodeId: parsed.nodeId },
  });
  await writeAudit({
    workspaceId: ws.id,
    actorUserId: user.id,
    actorRole: ctx.role,
    action: 'tree_node.update',
    resourceType: 'tree_node',
    resourceId: parsed.nodeId,
    before,
    after: {
      title: parsed.title,
      description: parsed.description,
      bodyMd: parsed.bodyMd,
      nodeType: parsed.nodeType,
      estMinutes: parsed.estMinutes,
    },
  });
  revalidatePath(`/w/${ws.slug}`);
}

/* ============================ Delete ============================ */
export async function deleteTreeNode(workspaceSlug: string, nodeId: string): Promise<void> {
  // Destructive — OWNER (80) only. Editors cannot wipe other people's work.
  const { ws, user, ctx } = await resolveWorkspace(workspaceSlug, RBAC_LEVELS.OWNER);

  // Capture before-state for audit (title at minimum, so the audit row is
  // useful when the node is gone).
  const beforeRows = await db
    .select({
      id: roadmapTreeNodes.id,
      title: roadmapTreeNodes.title,
      slug: roadmapTreeNodes.slug,
      parentId: roadmapTreeNodes.parentId,
      nodeType: roadmapTreeNodes.nodeType,
    })
    .from(roadmapTreeNodes)
    .where(and(eq(roadmapTreeNodes.id, nodeId), eq(roadmapTreeNodes.workspaceId, ws.id)))
    .limit(1);
  const before = beforeRows[0] ?? null;

  // Subtree deleted automatically via ON DELETE CASCADE on parent_id FK? No FK here.
  // Manual cascade: delete children via pathStr LIKE. Tenant-scoped WHERE
  // makes this safe against TOCTOU: a nodeId from another workspace cannot
  // collide because the workspace_id filter rejects it.
  await db.execute(
    dsql`DELETE FROM roadmap_tree_nodes WHERE workspace_id = ${ws.id}
         AND (id = ${nodeId} OR path_str LIKE ${nodeId + '%'} OR path_str LIKE ${'%/' + nodeId + '%'})`,
  );
  await db.insert(activityLog).values({
    workspaceId: ws.id,
    userId: user.id,
    kind: 'tree_node_deleted',
    payload: { nodeId },
  });
  await writeAudit({
    workspaceId: ws.id,
    actorUserId: user.id,
    actorRole: ctx.role,
    action: 'tree_node.delete',
    resourceType: 'tree_node',
    resourceId: nodeId,
    before,
    after: null,
  });
  revalidatePath(`/w/${ws.slug}`);
}

/* ============================ Reorder (up / down within same parent) ============================ */
const moveInput = z.object({
  workspaceSlug: z.string(),
  nodeId: z.string().uuid(),
  direction: z.enum(['up', 'down']),
});

export async function moveTreeNode(input: z.infer<typeof moveInput>): Promise<void> {
  const parsed = moveInput.parse(input);
  // Reorder is a structural edit — same level as update.
  const { ws, user } = await resolveWorkspace(parsed.workspaceSlug, RBAC_LEVELS.EDITOR);

  const me = await db
    .select()
    .from(roadmapTreeNodes)
    .where(and(eq(roadmapTreeNodes.id, parsed.nodeId), eq(roadmapTreeNodes.workspaceId, ws.id)))
    .limit(1);
  if (!me[0]) throw new Error('NODE_NOT_FOUND');

  const siblingsCondition = me[0].parentId
    ? and(
        eq(roadmapTreeNodes.workspaceId, ws.id),
        eq(roadmapTreeNodes.parentId, me[0].parentId),
      )
    : and(
        eq(roadmapTreeNodes.workspaceId, ws.id),
        dsql`${roadmapTreeNodes.parentId} IS NULL`,
      );

  const siblings = await db
    .select()
    .from(roadmapTreeNodes)
    .where(siblingsCondition)
    .orderBy(asc(roadmapTreeNodes.orderIndex));

  const idx = siblings.findIndex((s) => s.id === parsed.nodeId);
  if (idx < 0) throw new Error('NODE_NOT_FOUND');

  const swapIdx = parsed.direction === 'up' ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= siblings.length) return; // boundary, no-op

  const a = siblings[idx]!;
  const b = siblings[swapIdx]!;
  // Swap orderIndex
  await db
    .update(roadmapTreeNodes)
    .set({ orderIndex: b.orderIndex })
    .where(eq(roadmapTreeNodes.id, a.id));
  await db
    .update(roadmapTreeNodes)
    .set({ orderIndex: a.orderIndex })
    .where(eq(roadmapTreeNodes.id, b.id));

  await db.insert(activityLog).values({
    workspaceId: ws.id,
    userId: user.id,
    kind: 'tree_node_moved',
    payload: { nodeId: parsed.nodeId, direction: parsed.direction },
  });
  revalidatePath(`/w/${ws.slug}`);
}

/* ============================ Toggle progress (HIERARCHICAL GATE) ============================
 * Rule:
 *  - To mark a node DONE, ALL descendants must already be DONE (recursive enforcement).
 *  - Marking TODO cascades UP: any "done" ancestor gets un-marked (data consistency).
 *  - Error code INCOMPLETE_CHILDREN allows UI to show meaningful message in Vietnamese.
 */
export async function toggleNodeDone(
  workspaceSlug: string,
  nodeId: string,
): Promise<{ action: 'marked_done' | 'marked_todo'; cascadedUp: number; incomplete?: number }> {
  // Per RBAC spec: progress toggle requires EDITOR (60). Owners + super_admin
  // also pass. Learners and viewers cannot mark progress on this workspace.
  const { ws, user, ctx } = await resolveWorkspace(workspaceSlug, RBAC_LEVELS.EDITOR);

  const meRows = await db
    .select()
    .from(roadmapTreeNodes)
    .where(and(eq(roadmapTreeNodes.id, nodeId), eq(roadmapTreeNodes.workspaceId, ws.id)))
    .limit(1);
  if (!meRows[0]) throw new Error('NODE_NOT_FOUND');
  const me = meRows[0];

  const existing = await db
    .select()
    .from(userNodeProgress)
    .where(
      and(
        eq(userNodeProgress.workspaceId, ws.id),
        eq(userNodeProgress.userId, user.id),
        eq(userNodeProgress.nodeId, nodeId),
      ),
    )
    .limit(1);
  const isDone = existing[0]?.status === 'done';

  if (isDone) {
    /* === UN-DONE: cascade up (any ancestor "done" must un-done) === */
    if (existing[0]) {
      await db
        .update(userNodeProgress)
        .set({ status: 'todo', completedAt: null, updatedAt: new Date() })
        .where(eq(userNodeProgress.id, existing[0].id));
    }
    const ancestorIds = (me.pathStr ?? '').split('/').filter(Boolean);
    let cascaded = 0;
    for (const aid of ancestorIds) {
      const ap = await db
        .select()
        .from(userNodeProgress)
        .where(
          and(
            eq(userNodeProgress.workspaceId, ws.id),
            eq(userNodeProgress.userId, user.id),
            eq(userNodeProgress.nodeId, aid),
          ),
        )
        .limit(1);
      if (ap[0]?.status === 'done') {
        await db
          .update(userNodeProgress)
          .set({ status: 'todo', completedAt: null, updatedAt: new Date() })
          .where(eq(userNodeProgress.id, ap[0].id));
        cascaded++;
      }
    }
    await db.insert(activityLog).values({
      workspaceId: ws.id,
      userId: user.id,
      kind: 'tree_node_undone',
      payload: { nodeId, cascadedAncestors: cascaded },
    });
    await writeAudit({
      workspaceId: ws.id,
      actorUserId: user.id,
      actorRole: ctx.role,
      action: 'tree_node.toggle_done',
      resourceType: 'tree_node',
      resourceId: nodeId,
      before: { status: 'done' },
      after: { status: 'todo', cascadedAncestors: cascaded },
    });
    revalidatePath(`/w/${ws.slug}`);
    return { action: 'marked_todo', cascadedUp: cascaded };
  }

  /* === MARK DONE: gate on descendants === */
  // Find ALL descendant ids of this node via pathStr containment.
  // pathStr stored as "rootId/childId/grandId" — descendants have nodeId inside their pathStr.
  const allChildrenRows = await db
    .select({ id: roadmapTreeNodes.id })
    .from(roadmapTreeNodes)
    .where(
      and(
        eq(roadmapTreeNodes.workspaceId, ws.id),
        dsql`(${roadmapTreeNodes.pathStr} = ${nodeId}
              OR ${roadmapTreeNodes.pathStr} LIKE ${nodeId + '/%'}
              OR ${roadmapTreeNodes.pathStr} LIKE ${'%/' + nodeId}
              OR ${roadmapTreeNodes.pathStr} LIKE ${'%/' + nodeId + '/%'})`,
      ),
    );
  const descendantIds = allChildrenRows.map((r) => r.id).filter((id) => id !== nodeId);

  if (descendantIds.length > 0) {
    // Count done among descendants
    const doneRows = await db
      .select({ nodeId: userNodeProgress.nodeId })
      .from(userNodeProgress)
      .where(
        and(
          eq(userNodeProgress.workspaceId, ws.id),
          eq(userNodeProgress.userId, user.id),
          eq(userNodeProgress.status, 'done'),
        ),
      );
    const doneSet = new Set(doneRows.map((r) => r.nodeId));
    const incomplete = descendantIds.filter((id) => !doneSet.has(id));
    if (incomplete.length > 0) {
      // Throw with structured info so UI can show count
      const err = new Error(
        `INCOMPLETE_CHILDREN:${incomplete.length}:Còn ${incomplete.length}/${descendantIds.length} mục con chưa xong — hoàn thành chúng trước.`,
      );
      throw err;
    }
  }

  // OK — mark done
  if (existing[0]) {
    await db
      .update(userNodeProgress)
      .set({ status: 'done', completedAt: new Date(), updatedAt: new Date() })
      .where(eq(userNodeProgress.id, existing[0].id));
  } else {
    await db.insert(userNodeProgress).values({
      workspaceId: ws.id,
      userId: user.id,
      nodeId,
      status: 'done',
      completedAt: new Date(),
    });
  }
  await db.insert(activityLog).values({
    workspaceId: ws.id,
    userId: user.id,
    kind: 'tree_node_done',
    payload: { nodeId, descendants: descendantIds.length },
  });
  await writeAudit({
    workspaceId: ws.id,
    actorUserId: user.id,
    actorRole: ctx.role,
    action: 'tree_node.toggle_done',
    resourceType: 'tree_node',
    resourceId: nodeId,
    before: { status: existing[0]?.status ?? 'todo' },
    after: { status: 'done', descendants: descendantIds.length },
  });
  revalidatePath(`/w/${ws.slug}`);
  return { action: 'marked_done', cascadedUp: 0 };
}
