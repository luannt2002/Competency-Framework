/**
 * Role profile server actions — V8 verified competency engine.
 *
 * Roles are workspace-scoped templates of "what skills (and at what level) a
 * person in this role needs". A user can opt into a target role, and the
 * `computeGapAnalysis` helper produces the radar-chart payload (current vs
 * required + per-skill confidence).
 */
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { eq, and, inArray } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import {
  workspaces,
  skills,
  competencyLevels,
  userSkillProgress,
  activityLog,
} from '@/lib/db/schema';
import {
  roleProfiles,
  roleSkillRequirements,
  userRoleTargets,
  evidenceGrades,
  type RoleProfile,
} from '@/lib/db/schema-v8';
import { requireUser } from '@/lib/auth/supabase-server';
import {
  computeConfidenceFromGrades,
  type ConfidenceResult,
} from '@/lib/evidence/confidence';

/* ============================ HELPERS ============================ */

async function resolveWorkspace(slug: string, userId: string) {
  const rows = await db
    .select({ id: workspaces.id, slug: workspaces.slug })
    .from(workspaces)
    .where(and(eq(workspaces.slug, slug), eq(workspaces.ownerUserId, userId)))
    .limit(1);
  if (!rows[0]) throw new Error('WORKSPACE_NOT_FOUND_OR_FORBIDDEN');
  return rows[0];
}

async function assertRoleInWorkspace(roleId: string, workspaceId: string) {
  const rows = await db
    .select({ id: roleProfiles.id })
    .from(roleProfiles)
    .where(and(eq(roleProfiles.id, roleId), eq(roleProfiles.workspaceId, workspaceId)))
    .limit(1);
  if (!rows[0]) throw new Error('ROLE_NOT_IN_WORKSPACE');
}

async function assertSkillInWorkspace(skillId: string, workspaceId: string) {
  const rows = await db
    .select({ id: skills.id })
    .from(skills)
    .where(and(eq(skills.id, skillId), eq(skills.workspaceId, workspaceId)))
    .limit(1);
  if (!rows[0]) throw new Error('SKILL_NOT_IN_WORKSPACE');
}

/* ============================ LIST ============================ */

export type RoleProfileRow = Pick<
  RoleProfile,
  'id' | 'slug' | 'name' | 'description' | 'parentRoleId' | 'createdAt'
>;

export async function listRoleProfiles(workspaceSlug: string): Promise<RoleProfileRow[]> {
  const user = await requireUser();
  const ws = await resolveWorkspace(workspaceSlug, user.id);
  const rows = await db
    .select({
      id: roleProfiles.id,
      slug: roleProfiles.slug,
      name: roleProfiles.name,
      description: roleProfiles.description,
      parentRoleId: roleProfiles.parentRoleId,
      createdAt: roleProfiles.createdAt,
    })
    .from(roleProfiles)
    .where(eq(roleProfiles.workspaceId, ws.id));
  return rows;
}

/* ============================ UPSERT ROLE ============================ */

const upsertRoleInput = z.object({
  workspaceSlug: z.string().min(1),
  id: z.string().uuid().optional(),
  slug: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9-]+$/, 'slug must be kebab-case'),
  name: z.string().min(1).max(120),
  description: z.string().max(2_000).optional(),
  parentRoleId: z.string().uuid().nullable().optional(),
});

export type UpsertRoleProfileInput = z.infer<typeof upsertRoleInput>;

export async function upsertRoleProfile(
  input: UpsertRoleProfileInput,
): Promise<{ id: string }> {
  const user = await requireUser();
  const parsed = upsertRoleInput.parse(input);
  const ws = await resolveWorkspace(parsed.workspaceSlug, user.id);

  if (parsed.parentRoleId) {
    await assertRoleInWorkspace(parsed.parentRoleId, ws.id);
  }

  let roleId: string;
  if (parsed.id) {
    await assertRoleInWorkspace(parsed.id, ws.id);
    await db
      .update(roleProfiles)
      .set({
        slug: parsed.slug,
        name: parsed.name,
        description: parsed.description ?? null,
        parentRoleId: parsed.parentRoleId ?? null,
      })
      .where(eq(roleProfiles.id, parsed.id));
    roleId = parsed.id;
  } else {
    const inserted = await db
      .insert(roleProfiles)
      .values({
        workspaceId: ws.id,
        slug: parsed.slug,
        name: parsed.name,
        description: parsed.description ?? null,
        parentRoleId: parsed.parentRoleId ?? null,
      })
      .returning({ id: roleProfiles.id });
    const newId = inserted[0]?.id;
    if (!newId) throw new Error('ROLE_INSERT_FAILED');
    roleId = newId;
  }

  await db.insert(activityLog).values({
    workspaceId: ws.id,
    userId: user.id,
    kind: parsed.id ? 'role_profile_updated' : 'role_profile_created',
    payload: { roleId, slug: parsed.slug, name: parsed.name },
  });

  revalidatePath(`/w/${ws.slug}`);
  revalidatePath(`/w/${ws.slug}`);
  return { id: roleId };
}

/* ============================ UPSERT REQUIREMENT ============================ */

const upsertReqInput = z.object({
  workspaceSlug: z.string().min(1),
  roleId: z.string().uuid(),
  skillId: z.string().uuid(),
  requiredLevelCode: z.string().min(1).max(20),
  weight: z.number().min(0).max(10).optional(),
});

export type UpsertRoleRequirementInput = z.infer<typeof upsertReqInput>;

export async function upsertRoleRequirement(
  input: UpsertRoleRequirementInput,
): Promise<{ ok: true }> {
  const user = await requireUser();
  const parsed = upsertReqInput.parse(input);
  const ws = await resolveWorkspace(parsed.workspaceSlug, user.id);

  await assertRoleInWorkspace(parsed.roleId, ws.id);
  await assertSkillInWorkspace(parsed.skillId, ws.id);

  const weightStr = (parsed.weight ?? 1).toFixed(2);

  const existing = await db
    .select({ id: roleSkillRequirements.id })
    .from(roleSkillRequirements)
    .where(
      and(
        eq(roleSkillRequirements.workspaceId, ws.id),
        eq(roleSkillRequirements.roleId, parsed.roleId),
        eq(roleSkillRequirements.skillId, parsed.skillId),
      ),
    )
    .limit(1);

  if (existing[0]) {
    await db
      .update(roleSkillRequirements)
      .set({
        requiredLevelCode: parsed.requiredLevelCode,
        weight: weightStr,
      })
      .where(eq(roleSkillRequirements.id, existing[0].id));
  } else {
    await db.insert(roleSkillRequirements).values({
      workspaceId: ws.id,
      roleId: parsed.roleId,
      skillId: parsed.skillId,
      requiredLevelCode: parsed.requiredLevelCode,
      weight: weightStr,
    });
  }

  await db.insert(activityLog).values({
    workspaceId: ws.id,
    userId: user.id,
    kind: 'role_requirement_upserted',
    payload: {
      roleId: parsed.roleId,
      skillId: parsed.skillId,
      requiredLevelCode: parsed.requiredLevelCode,
      weight: parsed.weight ?? 1,
    },
  });

  revalidatePath(`/w/${ws.slug}`);
  return { ok: true };
}

/* ============================ USER ROLE TARGET ============================ */

const setTargetInput = z.object({
  workspaceSlug: z.string().min(1),
  roleId: z.string().uuid(),
  targetDate: z.string().date().optional(),
});

export type SetUserRoleTargetInput = z.infer<typeof setTargetInput>;

export async function setUserRoleTarget(
  input: SetUserRoleTargetInput,
): Promise<{ ok: true }> {
  const user = await requireUser();
  const parsed = setTargetInput.parse(input);
  const ws = await resolveWorkspace(parsed.workspaceSlug, user.id);

  await assertRoleInWorkspace(parsed.roleId, ws.id);

  const existing = await db
    .select({ id: userRoleTargets.id })
    .from(userRoleTargets)
    .where(
      and(
        eq(userRoleTargets.workspaceId, ws.id),
        eq(userRoleTargets.userId, user.id),
        eq(userRoleTargets.roleId, parsed.roleId),
      ),
    )
    .limit(1);

  if (existing[0]) {
    await db
      .update(userRoleTargets)
      .set({ targetDate: parsed.targetDate ?? null })
      .where(eq(userRoleTargets.id, existing[0].id));
  } else {
    await db.insert(userRoleTargets).values({
      workspaceId: ws.id,
      userId: user.id,
      roleId: parsed.roleId,
      targetDate: parsed.targetDate ?? null,
    });
  }

  await db.insert(activityLog).values({
    workspaceId: ws.id,
    userId: user.id,
    kind: 'user_role_target_set',
    payload: { roleId: parsed.roleId, targetDate: parsed.targetDate ?? null },
  });

  revalidatePath(`/w/${ws.slug}`);
  revalidatePath(`/w/${ws.slug}`);
  return { ok: true };
}

/* ============================ GAP ANALYSIS ============================ */

export interface GapAnalysisRow {
  skillId: string;
  skillName: string;
  currentLevel: string | null;
  requiredLevel: string;
  /** required.numericValue - current.numericValue (negative = behind, positive = exceeds). */
  gap: number;
  confidence: ConfidenceResult;
}

/**
 * Compute the radar payload for "target vs current" for a role.
 * - Uses `competency_levels.numericValue` for ordering (XS=1, S=2, ...).
 * - If the user has no progress row, currentLevel is null and gap is the full
 *   required numeric (i.e. they are `required.numeric` levels behind).
 * - Confidence is computed per skill from all evidence grades.
 */
export async function computeGapAnalysis(
  workspaceSlug: string,
  roleId: string,
): Promise<GapAnalysisRow[]> {
  const user = await requireUser();
  const ws = await resolveWorkspace(workspaceSlug, user.id);
  const parsedRoleId = z.string().uuid().parse(roleId);
  await assertRoleInWorkspace(parsedRoleId, ws.id);

  // 1. Pull requirements + skill metadata.
  const reqRows = await db
    .select({
      skillId: roleSkillRequirements.skillId,
      requiredLevelCode: roleSkillRequirements.requiredLevelCode,
      skillName: skills.name,
    })
    .from(roleSkillRequirements)
    .innerJoin(skills, eq(skills.id, roleSkillRequirements.skillId))
    .where(
      and(
        eq(roleSkillRequirements.workspaceId, ws.id),
        eq(roleSkillRequirements.roleId, parsedRoleId),
      ),
    );

  if (reqRows.length === 0) return [];

  const skillIds = reqRows.map((r) => r.skillId);

  // 2. Level numeric lookup (workspace-scoped).
  const levelRows = await db
    .select({ code: competencyLevels.code, numericValue: competencyLevels.numericValue })
    .from(competencyLevels)
    .where(eq(competencyLevels.workspaceId, ws.id));
  const numericByCode = new Map<string, number>(
    levelRows.map((l) => [l.code, l.numericValue]),
  );

  // 3. Current progress per skill for this user.
  const progressRows = await db
    .select({
      skillId: userSkillProgress.skillId,
      levelCode: userSkillProgress.levelCode,
    })
    .from(userSkillProgress)
    .where(
      and(
        eq(userSkillProgress.workspaceId, ws.id),
        eq(userSkillProgress.userId, user.id),
        inArray(userSkillProgress.skillId, skillIds),
      ),
    );
  const progressBySkill = new Map<string, string | null>(
    progressRows.map((p) => [p.skillId, p.levelCode]),
  );

  // 4. Evidence grades for every required skill, grouped by skill.
  const gradeRows = await db
    .select({
      skillId: evidenceGrades.skillId,
      kind: evidenceGrades.kind,
      score: evidenceGrades.score,
    })
    .from(evidenceGrades)
    .where(
      and(
        eq(evidenceGrades.workspaceId, ws.id),
        eq(evidenceGrades.userId, user.id),
        inArray(evidenceGrades.skillId, skillIds),
      ),
    );
  const gradesBySkill = new Map<string, Array<{ kind: typeof gradeRows[number]['kind']; score: number }>>();
  for (const g of gradeRows) {
    const arr = gradesBySkill.get(g.skillId) ?? [];
    arr.push({ kind: g.kind, score: g.score });
    gradesBySkill.set(g.skillId, arr);
  }

  // 5. Compose.
  return reqRows.map<GapAnalysisRow>((r) => {
    const current = progressBySkill.get(r.skillId) ?? null;
    const requiredNum = numericByCode.get(r.requiredLevelCode) ?? 0;
    const currentNum = current ? numericByCode.get(current) ?? 0 : 0;
    return {
      skillId: r.skillId,
      skillName: r.skillName,
      currentLevel: current,
      requiredLevel: r.requiredLevelCode,
      gap: currentNum - requiredNum,
      confidence: computeConfidenceFromGrades(gradesBySkill.get(r.skillId) ?? []),
    };
  });
}
