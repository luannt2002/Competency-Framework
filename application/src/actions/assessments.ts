/**
 * Self-assessment server actions.
 * Upserts user_skill_progress and logs activity.
 */
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { skills, userSkillProgress, activityLog, workspaces } from '@/lib/db/schema';
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

const updateInput = z.object({
  workspaceSlug: z.string(),
  skillId: z.string().uuid(),
  levelCode: z.enum(['XS', 'S', 'M', 'L']).nullable(),
  noteMd: z.string().max(10_000).optional(),
  whyThisLevel: z.string().max(2_000).optional(),
  evidenceUrls: z.array(z.string().url()).max(20).optional(),
  targetLevelCode: z.enum(['XS', 'S', 'M', 'L']).nullable().optional(),
});

export type UpdateAssessmentInput = z.infer<typeof updateInput>;

export async function updateAssessment(input: UpdateAssessmentInput): Promise<{ ok: true }> {
  const parsed = updateInput.parse(input);

  // Self-assessment is personal progress data — LEARNER is enough.
  const { ws, user, ctx } = await resolveWorkspace(parsed.workspaceSlug, RBAC_LEVELS.LEARNER);

  // Verify skill belongs to workspace (defense in depth)
  const skillRows = await db
    .select({ id: skills.id })
    .from(skills)
    .where(and(eq(skills.id, parsed.skillId), eq(skills.workspaceId, ws.id)))
    .limit(1);
  if (!skillRows[0]) throw new Error('SKILL_NOT_IN_WORKSPACE');

  // Upsert progress
  const existing = await db
    .select({ id: userSkillProgress.id, levelCode: userSkillProgress.levelCode })
    .from(userSkillProgress)
    .where(
      and(
        eq(userSkillProgress.workspaceId, ws.id),
        eq(userSkillProgress.userId, user.id),
        eq(userSkillProgress.skillId, parsed.skillId),
      ),
    )
    .limit(1);

  if (existing[0]) {
    await db
      .update(userSkillProgress)
      .set({
        levelCode: parsed.levelCode,
        noteMd: parsed.noteMd,
        whyThisLevel: parsed.whyThisLevel,
        evidenceUrls: parsed.evidenceUrls ?? [],
        targetLevelCode: parsed.targetLevelCode ?? null,
        levelSource: 'self_claimed',
        updatedAt: new Date(),
      })
      .where(eq(userSkillProgress.id, existing[0].id));
  } else {
    await db.insert(userSkillProgress).values({
      workspaceId: ws.id,
      userId: user.id,
      skillId: parsed.skillId,
      levelCode: parsed.levelCode,
      noteMd: parsed.noteMd,
      whyThisLevel: parsed.whyThisLevel,
      evidenceUrls: parsed.evidenceUrls ?? [],
      targetLevelCode: parsed.targetLevelCode ?? null,
      levelSource: 'self_claimed',
    });
  }

  await db.insert(activityLog).values({
    workspaceId: ws.id,
    userId: user.id,
    kind: 'assessment_updated',
    payload: { skillId: parsed.skillId, levelCode: parsed.levelCode },
  });

  await writeAudit({
    workspaceId: ws.id,
    actorUserId: user.id,
    actorRole: ctx.role,
    action: 'assessment.update',
    resourceType: 'skill_assessment',
    resourceId: parsed.skillId,
    before: { levelCode: existing[0]?.levelCode ?? null },
    after: {
      levelCode: parsed.levelCode,
      targetLevelCode: parsed.targetLevelCode ?? null,
      evidenceCount: parsed.evidenceUrls?.length ?? 0,
    },
  });

  revalidatePath(`/w/${ws.slug}`);
  revalidatePath(`/w/${ws.slug}/skills`);
  return { ok: true };
}
