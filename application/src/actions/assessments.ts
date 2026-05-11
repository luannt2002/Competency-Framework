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
  const user = await requireUser();
  const parsed = updateInput.parse(input);

  // Resolve workspace + verify ownership
  const wsRows = await db
    .select({ id: workspaces.id, slug: workspaces.slug })
    .from(workspaces)
    .where(and(eq(workspaces.slug, parsed.workspaceSlug), eq(workspaces.ownerUserId, user.id)))
    .limit(1);
  const ws = wsRows[0];
  if (!ws) throw new Error('WORKSPACE_NOT_FOUND_OR_FORBIDDEN');

  // Verify skill belongs to workspace (defense in depth)
  const skillRows = await db
    .select({ id: skills.id })
    .from(skills)
    .where(and(eq(skills.id, parsed.skillId), eq(skills.workspaceId, ws.id)))
    .limit(1);
  if (!skillRows[0]) throw new Error('SKILL_NOT_IN_WORKSPACE');

  // Upsert progress
  const existing = await db
    .select({ id: userSkillProgress.id })
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

  revalidatePath(`/w/${ws.slug}`);
  revalidatePath(`/w/${ws.slug}/skills`);
  return { ok: true };
}
