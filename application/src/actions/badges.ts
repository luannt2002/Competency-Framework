/**
 * Badge CRUD server actions — F16 creator custom badges.
 *
 * Permission: EDITOR+ (`RBAC_LEVELS.EDITOR`, 60). Rationale: badge DESIGN is
 * content authoring, not workspace administration — settings/members/import
 * are OWNER, but editors already shape what learners see (nodes, lessons), and
 * badges are the same class of content. Deletion is intentionally restricted
 * (see deleteBadge).
 *
 * Invariants:
 *   - Every statement on workspace-scoped tables filters by workspaceId.
 *   - A badge learners already EARNED is never hard-deleted — deactivate only,
 *     so user_badges rows survive (audit trail + profile history).
 *   - Icon must be one of BADGE_ICON_KEYS; rule validated by the shared pure
 *     validator (validateRuleForm) — same logic as the client form.
 *
 * Audit actions: badge.create / badge.update / badge.activate / badge.deactivate.
 */
'use server';
import { and, eq, count } from 'drizzle-orm';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db/client';
import { userBadges } from '@/lib/db/schema';
import { badgesAdmin } from '@/lib/db/schema-badges';
import { resolveWorkspace } from '@/lib/rbac/resolve';
import { writeAudit } from '@/lib/rbac/server';
import { RBAC_LEVELS } from '@/lib/rbac/levels';
import {
  validateRuleForm,
  slugifyBadgeName,
  BADGE_ICON_KEYS,
  type RuleFormValues,
} from '@/lib/badges/rule-form';

const baseInput = z.object({
  workspaceSlug: z.string().min(1),
  name: z.string().min(1).max(80),
  description: z.string().max(500).optional().nullable(),
  icon: z.enum(BADGE_ICON_KEYS),
});

export async function createBadge(
  workspaceSlug: string,
  input: { name: string; description?: string | null; icon: string; ruleForm: RuleFormValues },
): Promise<void> {
  const parsed = baseInput
    .extend({ ruleForm: z.custom<RuleFormValues>() })
    .parse({ workspaceSlug, ...input });
  const { ws, user, ctx } = await resolveWorkspace(parsed.workspaceSlug, RBAC_LEVELS.EDITOR);

  const v = validateRuleForm(parsed.ruleForm);
  if (!v.ok) throw new Error('BADGE_RULE_INVALID');

  // Slug: derived from name, uniqueness-resolved within the workspace.
  const base = slugifyBadgeName(parsed.name);
  const existing = await db
    .select({ slug: badgesAdmin.slug })
    .from(badgesAdmin)
    .where(eq(badgesAdmin.workspaceId, ws.id));
  const taken = new Set(existing.map((r) => r.slug));
  let slug = base;
  for (let i = 2; taken.has(slug); i++) slug = `${base}-${i}`;

  const [row] = await db
    .insert(badgesAdmin)
    .values({
      workspaceId: ws.id,
      slug,
      name: parsed.name,
      description: parsed.description ?? null,
      icon: parsed.icon,
      rule: v.rule,
      isActive: true,
    })
    .returning({ id: badgesAdmin.id });

  await writeAudit({
    workspaceId: ws.id,
    actorUserId: user.id,
    actorRole: ctx.role,
    action: 'badge.create',
    resourceType: 'badge',
    resourceId: row!.id,
    after: { slug, name: parsed.name, rule: v.rule },
  });

  revalidatePath(`/w/${ws.slug}/badges`);
}

export async function updateBadge(
  workspaceSlug: string,
  badgeId: string,
  input: { name: string; description?: string | null; icon: string; ruleForm: RuleFormValues },
): Promise<void> {
  const parsed = baseInput
    .extend({ badgeId: z.string().uuid(), ruleForm: z.custom<RuleFormValues>() })
    .parse({ workspaceSlug, badgeId, ...input });
  const { ws, user, ctx } = await resolveWorkspace(parsed.workspaceSlug, RBAC_LEVELS.EDITOR);

  const v = validateRuleForm(parsed.ruleForm);
  if (!v.ok) throw new Error('BADGE_RULE_INVALID');

  const rows = await db
    .select({ id: badgesAdmin.id, name: badgesAdmin.name, rule: badgesAdmin.rule })
    .from(badgesAdmin)
    .where(and(eq(badgesAdmin.id, parsed.badgeId), eq(badgesAdmin.workspaceId, ws.id)))
    .limit(1);
  const before = rows[0];
  if (!before) throw new Error('BADGE_NOT_FOUND');

  await db
    .update(badgesAdmin)
    .set({
      name: parsed.name,
      description: parsed.description ?? null,
      icon: parsed.icon,
      rule: v.rule,
    })
    .where(and(eq(badgesAdmin.id, parsed.badgeId), eq(badgesAdmin.workspaceId, ws.id)));

  await writeAudit({
    workspaceId: ws.id,
    actorUserId: user.id,
    actorRole: ctx.role,
    action: 'badge.update',
    resourceType: 'badge',
    resourceId: parsed.badgeId,
    before: { name: before.name, rule: before.rule },
    after: { name: parsed.name, rule: v.rule },
  });

  revalidatePath(`/w/${ws.slug}/badges`);
}

/** Soft toggle. Deactivation stops future grants; earned rows are untouched. */
export async function setBadgeActive(
  workspaceSlug: string,
  badgeId: string,
  active: boolean,
): Promise<void> {
  const parsed = z
    .object({ workspaceSlug: z.string().min(1), badgeId: z.string().uuid(), active: z.boolean() })
    .parse({ workspaceSlug, badgeId, active });
  const { ws, user, ctx } = await resolveWorkspace(parsed.workspaceSlug, RBAC_LEVELS.EDITOR);

  const rows = await db
    .select({ isActive: badgesAdmin.isActive })
    .from(badgesAdmin)
    .where(and(eq(badgesAdmin.id, parsed.badgeId), eq(badgesAdmin.workspaceId, ws.id)))
    .limit(1);
  const before = rows[0];
  if (!before) throw new Error('BADGE_NOT_FOUND');

  await db
    .update(badgesAdmin)
    .set({ isActive: parsed.active })
    .where(and(eq(badgesAdmin.id, parsed.badgeId), eq(badgesAdmin.workspaceId, ws.id)));

  await writeAudit({
    workspaceId: ws.id,
    actorUserId: user.id,
    actorRole: ctx.role,
    action: parsed.active ? 'badge.activate' : 'badge.deactivate',
    resourceType: 'badge',
    resourceId: parsed.badgeId,
    before: { isActive: before.isActive },
    after: { isActive: parsed.active },
  });

  revalidatePath(`/w/${ws.slug}/badges`);
}

/**
 * Hard delete — ONLY when no learner has ever earned the badge. If anyone has
 * (user_badges rows exist), the FK would cascade-delete their earned history,
 * so the action refuses; the UI offers deactivation instead.
 */
export async function deleteBadge(workspaceSlug: string, badgeId: string): Promise<void> {
  const parsed = z
    .object({ workspaceSlug: z.string().min(1), badgeId: z.string().uuid() })
    .parse({ workspaceSlug, badgeId });
  const { ws, user, ctx } = await resolveWorkspace(parsed.workspaceSlug, RBAC_LEVELS.EDITOR);

  const [earnedRow] = await db
    .select({ n: count() })
    .from(userBadges)
    .where(
      and(eq(userBadges.workspaceId, ws.id), eq(userBadges.badgeId, parsed.badgeId)),
    );
  if ((earnedRow?.n ?? 0) > 0) throw new Error('BADGE_HAS_EARNERS_DEACTIVATE_INSTEAD');

  const rows = await db
    .select({ slug: badgesAdmin.slug, name: badgesAdmin.name })
    .from(badgesAdmin)
    .where(and(eq(badgesAdmin.id, parsed.badgeId), eq(badgesAdmin.workspaceId, ws.id)))
    .limit(1);
  const before = rows[0];
  if (!before) throw new Error('BADGE_NOT_FOUND');

  await db
    .delete(badgesAdmin)
    .where(and(eq(badgesAdmin.id, parsed.badgeId), eq(badgesAdmin.workspaceId, ws.id)));

  await writeAudit({
    workspaceId: ws.id,
    actorUserId: user.id,
    actorRole: ctx.role,
    action: 'badge.delete',
    resourceType: 'badge',
    resourceId: parsed.badgeId,
    before: { slug: before.slug, name: before.name },
    after: null,
  });

  revalidatePath(`/w/${ws.slug}/badges`);
}
