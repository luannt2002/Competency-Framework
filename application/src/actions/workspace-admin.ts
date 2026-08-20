/**
 * Workspace admin server actions — OWNER-only.
 *
 * Backs the `/w/[slug]/settings` admin surface (rename, visibility toggle,
 * delete). Same resolve-then-RBAC pattern as `workspace-members.ts` so a
 * non-owner or unknown slug surfaces a unified error.
 *
 * Audit actions written here:
 *   - workspace.rename
 *   - workspace.visibility_update
 *   - workspace.delete
 *
 * NOTE: `workspaces.visibility` is a pg enum of `'private' | 'public-readonly'`.
 * The UI uses the simpler labels "private" / "public"; we map "public" → the
 * stored 'public-readonly' value here so callers stay schema-agnostic.
 */
'use server';
import { resolveOwnerWorkspace } from '@/lib/rbac/resolve';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { eq, and, isNull } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { workspaces } from '@/lib/db/schema';
import { writeAudit } from '@/lib/rbac/server';


const renameInput = z.object({
  workspaceSlug: z.string(),
  name: z.string().min(1).max(80),
});

export async function renameWorkspace(workspaceSlug: string, name: string): Promise<void> {
  const parsed = renameInput.parse({ workspaceSlug, name });
  const { ws, user, ctx } = await resolveOwnerWorkspace(parsed.workspaceSlug);

  await db.update(workspaces).set({ name: parsed.name }).where(eq(workspaces.id, ws.id));

  await writeAudit({
    workspaceId: ws.id,
    actorUserId: user.id,
    actorRole: ctx.role,
    action: 'workspace.rename',
    resourceType: 'workspace',
    resourceId: ws.id,
    before: { name: ws.name },
    after: { name: parsed.name },
  });

  revalidatePath(`/w/${ws.slug}/settings`);
}

/** UI-friendly visibility values; mapped to DB enum internally. */
export type VisibilityValue = 'private' | 'public';

const visibilityInput = z.object({
  workspaceSlug: z.string(),
  value: z.enum(['private', 'public']),
});

export async function setWorkspaceVisibility(
  workspaceSlug: string,
  value: VisibilityValue,
): Promise<void> {
  const parsed = visibilityInput.parse({ workspaceSlug, value });
  const { ws, user, ctx } = await resolveOwnerWorkspace(parsed.workspaceSlug);

  const storedValue: 'private' | 'public-readonly' =
    parsed.value === 'private' ? 'private' : 'public-readonly';

  await db
    .update(workspaces)
    .set({ visibility: storedValue })
    .where(eq(workspaces.id, ws.id));

  await writeAudit({
    workspaceId: ws.id,
    actorUserId: user.id,
    actorRole: ctx.role,
    action: 'workspace.visibility_update',
    resourceType: 'workspace',
    resourceId: ws.id,
    before: { visibility: ws.visibility },
    after: { visibility: storedValue },
  });

  revalidatePath(`/w/${ws.slug}/settings`);
}

const appearanceInput = z.object({
  workspaceSlug: z.string(),
  icon: z.string().min(1).max(8),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

/**
 * Update workspace appearance (emoji icon + accent color).
 * Both values are validated against the curated palettes in
 * `src/lib/theme/workspace-theme.ts` — no free-form CSS/emoji injection.
 */
export async function updateWorkspaceAppearance(
  workspaceSlug: string,
  icon: string,
  accentColor: string,
): Promise<void> {
  const parsed = appearanceInput.parse({ workspaceSlug, icon, accentColor });
  const { isEmojiAllowed, isAccentAllowed } = await import('@/lib/theme/workspace-theme');
  if (!isEmojiAllowed(parsed.icon)) throw new Error('INVALID_ICON');
  if (!isAccentAllowed(parsed.accentColor)) throw new Error('INVALID_ACCENT');

  const { ws, user, ctx } = await resolveOwnerWorkspace(parsed.workspaceSlug);

  await db
    .update(workspaces)
    .set({ icon: parsed.icon, color: parsed.accentColor })
    .where(eq(workspaces.id, ws.id));

  await writeAudit({
    workspaceId: ws.id,
    actorUserId: user.id,
    actorRole: ctx.role,
    action: 'workspace.appearance_update',
    resourceType: 'workspace',
    resourceId: ws.id,
    after: { icon: parsed.icon, color: parsed.accentColor },
  });

  revalidatePath(`/w/${ws.slug}`, 'layout');
  revalidatePath(`/w/${ws.slug}/settings`);
}

const levelInput = z.object({
  workspaceSlug: z.string(),
  levelId: z.string().uuid(),
  label: z.string().min(1).max(40),
  description: z.string().max(1000).optional(),
});

/**
 * Update a competency level's display label (+ optional description).
 * The `code` (XS/S/M/L…) stays fixed as the internal key — teams can rename
 * what learners see (e.g. M → "Senior") without breaking stored progress.
 */
export async function updateCompetencyLevel(
  workspaceSlug: string,
  levelId: string,
  label: string,
  description?: string,
): Promise<void> {
  const parsed = levelInput.parse({ workspaceSlug, levelId, label, description });
  const { ws, user, ctx } = await resolveOwnerWorkspace(parsed.workspaceSlug);

  const { competencyLevels } = await import('@/lib/db/schema');
  const rows = await db
    .select({ id: competencyLevels.id, label: competencyLevels.label })
    .from(competencyLevels)
    .where(and(eq(competencyLevels.id, parsed.levelId), eq(competencyLevels.workspaceId, ws.id)))
    .limit(1);
  const level = rows[0];
  if (!level) throw new Error('LEVEL_NOT_FOUND');

  await db
    .update(competencyLevels)
    .set({
      label: parsed.label,
      ...(parsed.description !== undefined ? { description: parsed.description } : {}),
    })
    .where(
      and(eq(competencyLevels.id, parsed.levelId), eq(competencyLevels.workspaceId, ws.id)),
    );

  await writeAudit({
    workspaceId: ws.id,
    actorUserId: user.id,
    actorRole: ctx.role,
    action: 'level.update',
    resourceType: 'competency_level',
    resourceId: parsed.levelId,
    before: { label: level.label },
    after: { label: parsed.label },
  });

  revalidatePath(`/w/${ws.slug}/settings`);
  revalidatePath(`/w/${ws.slug}/skills`);
}

const nodeTypeRowInput = z.object({
  nodeType: z.string().min(1).max(40),
  icon: z.string().min(1).max(8).nullable(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable(),
});

const nodeTypesInput = z.object({
  workspaceSlug: z.string(),
  rows: z.array(nodeTypeRowInput).max(30),
});

/**
 * Bulk-save node-type appearance overrides (emoji icon + accent color).
 * Empty rows (icon=null, color=null) delete the override so defaults return.
 */
export async function saveNodeTypeAppearance(
  workspaceSlug: string,
  rows: Array<{ nodeType: string; icon: string | null; color: string | null }>,
): Promise<void> {
  const parsed = nodeTypesInput.parse({ workspaceSlug, rows });
  const { isEmojiAllowed, isAccentAllowed } = await import('@/lib/theme/workspace-theme');
  const { nodeTypeAppearance } = await import('@/lib/db/schema');

  const { ws, user, ctx } = await resolveOwnerWorkspace(parsed.workspaceSlug);

  for (const row of parsed.rows) {
    if (row.icon !== null && !isEmojiAllowed(row.icon)) throw new Error('INVALID_ICON');
    if (row.color !== null && !isAccentAllowed(row.color)) throw new Error('INVALID_ACCENT');
  }

  for (const row of parsed.rows) {
    await db
      .insert(nodeTypeAppearance)
      .values({
        workspaceId: ws.id,
        nodeType: row.nodeType,
        icon: row.icon,
        color: row.color,
        updatedAt: new Date().toISOString(),
      })
      .onConflictDoUpdate({
        target: [nodeTypeAppearance.workspaceId, nodeTypeAppearance.nodeType],
        set: { icon: row.icon, color: row.color, updatedAt: new Date().toISOString() },
      });
    // Remove fully-cleared overrides so defaults come back.
    await db
      .delete(nodeTypeAppearance)
      .where(
        and(
          eq(nodeTypeAppearance.workspaceId, ws.id),
          eq(nodeTypeAppearance.nodeType, row.nodeType),
          isNull(nodeTypeAppearance.icon),
          isNull(nodeTypeAppearance.color),
        ),
      );
  }

  await writeAudit({
    workspaceId: ws.id,
    actorUserId: user.id,
    actorRole: ctx.role,
    action: 'workspace.nodetype_appearance_update',
    resourceType: 'workspace',
    resourceId: ws.id,
    after: { rows: parsed.rows.length },
  });

  revalidatePath(`/w/${ws.slug}`, 'layout');
  revalidatePath(`/w/${ws.slug}/settings`);
}

const categoryColorInput = z.object({
  workspaceSlug: z.string(),
  categoryId: z.string().uuid(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable(),
});

/** Update a skill-category color (or clear to null for the default gray). */
export async function updateCategoryColor(
  workspaceSlug: string,
  categoryId: string,
  color: string | null,
): Promise<void> {
  const parsed = categoryColorInput.parse({ workspaceSlug, categoryId, color });
  const { isAccentAllowed } = await import('@/lib/theme/workspace-theme');
  if (parsed.color !== null && !isAccentAllowed(parsed.color)) throw new Error('INVALID_ACCENT');

  const { ws, user, ctx } = await resolveOwnerWorkspace(parsed.workspaceSlug);
  const { skillCategories } = await import('@/lib/db/schema');

  const rows = await db
    .select({ id: skillCategories.id, color: skillCategories.color })
    .from(skillCategories)
    .where(
      and(eq(skillCategories.id, parsed.categoryId), eq(skillCategories.workspaceId, ws.id)),
    )
    .limit(1);
  const cat = rows[0];
  if (!cat) throw new Error('CATEGORY_NOT_FOUND');

  await db
    .update(skillCategories)
    .set({ color: parsed.color })
    .where(
      and(eq(skillCategories.id, parsed.categoryId), eq(skillCategories.workspaceId, ws.id)),
    );

  await writeAudit({
    workspaceId: ws.id,
    actorUserId: user.id,
    actorRole: ctx.role,
    action: 'category.color_update',
    resourceType: 'skill_category',
    resourceId: parsed.categoryId,
    before: { color: cat.color },
    after: { color: parsed.color },
  });

  revalidatePath(`/w/${ws.slug}/skills`);
  revalidatePath(`/w/${ws.slug}/settings`);
}

export async function deleteWorkspace(workspaceSlug: string): Promise<void> {
  const slug = z.string().parse(workspaceSlug);
  const { ws, user, ctx } = await resolveOwnerWorkspace(slug);

  // Audit FIRST — the workspace_id FK becomes NULL on delete (ON DELETE SET
  // NULL on audit_log.workspace_id), but the row is preserved.
  await writeAudit({
    workspaceId: ws.id,
    actorUserId: user.id,
    actorRole: ctx.role,
    action: 'workspace.delete',
    resourceType: 'workspace',
    resourceId: ws.id,
    before: { slug: ws.slug, name: ws.name, visibility: ws.visibility },
    after: null,
  });

  // Cascading deletes are configured on most workspace-scoped tables.
  await db.delete(workspaces).where(eq(workspaces.id, ws.id));

  revalidatePath('/');
  redirect('/');
}
