/**
 * Self-assessment server actions.
 * Upserts user_skill_progress and logs activity.
 */
'use server';
import { resolveWorkspace } from '@/lib/rbac/resolve';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { skills, userSkillProgress, activityLog } from '@/lib/db/schema';
import { RBAC_LEVELS } from '@/lib/rbac/levels';
import { nextLevelSource } from '@/lib/skills/level-source';
import { writeAudit } from '@/lib/rbac/server';


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
    .select({
      id: userSkillProgress.id,
      levelCode: userSkillProgress.levelCode,
      levelSource: userSkillProgress.levelSource,
    })
    .from(userSkillProgress)
    .where(
      and(
        eq(userSkillProgress.workspaceId, ws.id),
        eq(userSkillProgress.userId, user.id),
        eq(userSkillProgress.skillId, parsed.skillId),
      ),
    )
    .limit(1);

  // KHÔNG ghi đè `self_claimed` vô điều kiện nữa: drawer tự lưu sau 700ms, nên
  // trước đây chỉ cần gõ một chữ vào ô ghi chú là `verified`/`both` bị xoá
  // (rà B6.4). Quy tắc nằm ở lib/skills/level-source.ts, có test 4 nhánh.
  const nextSource = nextLevelSource(existing[0]?.levelSource ?? null, 'self_assess');

  if (existing[0]) {
    await db
      .update(userSkillProgress)
      .set({
        levelCode: parsed.levelCode,
        noteMd: parsed.noteMd,
        whyThisLevel: parsed.whyThisLevel,
        evidenceUrls: parsed.evidenceUrls ?? [],
        targetLevelCode: parsed.targetLevelCode ?? null,
        levelSource: nextSource,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(userSkillProgress.id, existing[0].id),
          eq(userSkillProgress.workspaceId, ws.id),
        ),
      );
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
      levelSource: nextSource,
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
