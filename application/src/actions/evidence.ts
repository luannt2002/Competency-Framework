/**
 * Evidence server actions — V8 verified competency engine.
 *
 * Each evidence row contributes to a per-skill confidence score (weighted average,
 * see `@/lib/evidence/confidence`). When confidence >= 70 AND at least one
 * manager_review is on file, the user's `user_skill_progress.level_source` is
 * promoted to 'verified' (the enum currently has self_claimed/learned/both; we
 * use 'both' to represent the V8 "verified" state until the enum is extended in
 * a follow-up migration — see deviation note in handover).
 */
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import {
  skills,
  workspaces,
  userSkillProgress,
  activityLog,
} from '@/lib/db/schema';
import {
  evidenceGrades,
  skillAuditLog,
  type EvidenceKind,
  type EvidenceGrade,
} from '@/lib/db/schema-v8';
import { requireUser } from '@/lib/auth/supabase-server';
import {
  computeConfidenceFromGrades,
  VERIFIED_MIN_SCORE,
  type ConfidenceResult,
} from '@/lib/evidence/confidence';
import { RBAC_LEVELS } from '@/lib/rbac/levels';
import { requireMinLevel, writeAudit, RBACError } from '@/lib/rbac/server';

/* ============================ HELPERS ============================ */

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

async function assertSkillInWorkspace(skillId: string, workspaceId: string) {
  const rows = await db
    .select({ id: skills.id })
    .from(skills)
    .where(and(eq(skills.id, skillId), eq(skills.workspaceId, workspaceId)))
    .limit(1);
  if (!rows[0]) throw new Error('SKILL_NOT_IN_WORKSPACE');
}

/* ============================ SUBMIT EVIDENCE ============================ */

const submitInput = z.object({
  workspaceSlug: z.string().min(1),
  skillId: z.string().uuid(),
  kind: z.enum(['lab', 'project', 'peer_review', 'manager_review']),
  score: z.number().int().min(0).max(100),
  evidenceUrl: z.string().url().max(2_000).optional(),
  note: z.string().max(5_000).optional(),
});

export type SubmitEvidenceInput = z.infer<typeof submitInput>;

export interface SubmitEvidenceResult {
  gradeId: string;
  confidence: ConfidenceResult;
  promotedToVerified: boolean;
}

export async function submitEvidence(
  input: SubmitEvidenceInput,
): Promise<SubmitEvidenceResult> {
  const parsed = submitInput.parse(input);
  // Submitting own evidence is a personal progress write — LEARNER.
  const { ws, user, ctx } = await resolveWorkspace(parsed.workspaceSlug, RBAC_LEVELS.LEARNER);
  await assertSkillInWorkspace(parsed.skillId, ws.id);

  // Insert the new grade. Self-submitted lab/project rows have no reviewer.
  const isSelfKind = parsed.kind === 'lab' || parsed.kind === 'project';
  const inserted = await db
    .insert(evidenceGrades)
    .values({
      workspaceId: ws.id,
      userId: user.id,
      skillId: parsed.skillId,
      kind: parsed.kind,
      score: parsed.score,
      evidenceUrl: parsed.evidenceUrl,
      reviewerUserId: isSelfKind ? null : user.id,
      reviewedAt: isSelfKind ? null : new Date(),
      note: parsed.note,
    })
    .returning({ id: evidenceGrades.id });
  const gradeId = inserted[0]?.id;
  if (!gradeId) throw new Error('EVIDENCE_INSERT_FAILED');

  // Recompute confidence over ALL grades for this user+skill.
  const allGrades = await db
    .select({ kind: evidenceGrades.kind, score: evidenceGrades.score })
    .from(evidenceGrades)
    .where(
      and(
        eq(evidenceGrades.workspaceId, ws.id),
        eq(evidenceGrades.userId, user.id),
        eq(evidenceGrades.skillId, parsed.skillId),
      ),
    );

  const confidence = computeConfidenceFromGrades(allGrades);
  const hasManager = allGrades.some((g) => g.kind === 'manager_review');
  const shouldVerify = hasManager && confidence.score >= VERIFIED_MIN_SCORE;

  // Upsert user_skill_progress. M6.5: enum extended with 'verified'.
  const existing = await db
    .select({ id: userSkillProgress.id, levelSource: userSkillProgress.levelSource })
    .from(userSkillProgress)
    .where(
      and(
        eq(userSkillProgress.workspaceId, ws.id),
        eq(userSkillProgress.userId, user.id),
        eq(userSkillProgress.skillId, parsed.skillId),
      ),
    )
    .limit(1);

  const prevSource = existing[0]?.levelSource ?? null;
  const nextSource: 'self_claimed' | 'learned' | 'both' | 'verified' = shouldVerify
    ? 'verified'
    : prevSource === 'verified' || prevSource === 'both'
      ? prevSource
      : 'learned';

  if (existing[0]) {
    await db
      .update(userSkillProgress)
      .set({ levelSource: nextSource, updatedAt: new Date() })
      .where(eq(userSkillProgress.id, existing[0].id));
  } else {
    await db.insert(userSkillProgress).values({
      workspaceId: ws.id,
      userId: user.id,
      skillId: parsed.skillId,
      levelSource: nextSource,
    });
  }

  // Audit + activity log.
  await db.insert(skillAuditLog).values({
    workspaceId: ws.id,
    userId: user.id,
    skillId: parsed.skillId,
    action: 'evidence_added',
    fromValue: prevSource,
    toValue: nextSource,
    reason: `${parsed.kind} score=${parsed.score}`,
    actorUserId: user.id,
  });

  if (shouldVerify && prevSource !== 'both') {
    await db.insert(skillAuditLog).values({
      workspaceId: ws.id,
      userId: user.id,
      skillId: parsed.skillId,
      action: 'verified',
      fromValue: prevSource,
      toValue: 'both',
      reason: `confidence=${confidence.score}`,
      actorUserId: user.id,
    });
  }

  await db.insert(activityLog).values({
    workspaceId: ws.id,
    userId: user.id,
    kind: 'evidence_submitted',
    payload: {
      skillId: parsed.skillId,
      kind: parsed.kind,
      score: parsed.score,
      confidence: confidence.score,
      source: confidence.source,
    },
  });

  await writeAudit({
    workspaceId: ws.id,
    actorUserId: user.id,
    actorRole: ctx.role,
    action: 'evidence.submit',
    resourceType: 'evidence_grade',
    resourceId: gradeId,
    before: { levelSource: prevSource },
    after: {
      kind: parsed.kind,
      score: parsed.score,
      confidence: confidence.score,
      levelSource: nextSource,
      promotedToVerified: shouldVerify && prevSource !== 'both',
    },
  });

  revalidatePath(`/w/${ws.slug}`);
  revalidatePath(`/w/${ws.slug}/skills`);

  return {
    gradeId,
    confidence,
    promotedToVerified: shouldVerify && prevSource !== 'both',
  };
}

/* ============================ LIST EVIDENCE ============================ */

export type EvidenceRow = Pick<
  EvidenceGrade,
  | 'id'
  | 'kind'
  | 'score'
  | 'evidenceUrl'
  | 'reviewerUserId'
  | 'reviewedAt'
  | 'note'
  | 'createdAt'
>;

export async function listEvidenceForSkill(
  workspaceSlug: string,
  skillId: string,
): Promise<EvidenceRow[]> {
  const { ws, user } = await resolveWorkspace(workspaceSlug, RBAC_LEVELS.LEARNER);

  // Lightweight UUID shape check — Zod for symmetry with mutations.
  const parsed = z.string().uuid().parse(skillId);
  await assertSkillInWorkspace(parsed, ws.id);

  const rows = await db
    .select({
      id: evidenceGrades.id,
      kind: evidenceGrades.kind,
      score: evidenceGrades.score,
      evidenceUrl: evidenceGrades.evidenceUrl,
      reviewerUserId: evidenceGrades.reviewerUserId,
      reviewedAt: evidenceGrades.reviewedAt,
      note: evidenceGrades.note,
      createdAt: evidenceGrades.createdAt,
    })
    .from(evidenceGrades)
    .where(
      and(
        eq(evidenceGrades.workspaceId, ws.id),
        eq(evidenceGrades.userId, user.id),
        eq(evidenceGrades.skillId, parsed),
      ),
    );

  return rows;
}

/* ============================ VERIFY EVIDENCE (REVIEWER) ============================ */

const verifyInput = z.object({
  workspaceSlug: z.string().min(1),
  gradeId: z.string().uuid(),
  approved: z.boolean(),
  note: z.string().max(5_000).optional(),
});

export type VerifyEvidenceInput = z.infer<typeof verifyInput>;

export async function verifyEvidence(input: VerifyEvidenceInput): Promise<{ ok: true }> {
  const parsed = verifyInput.parse(input);
  // Reviewing/verifying someone else's evidence is an editorial action.
  const { ws, user, ctx } = await resolveWorkspace(parsed.workspaceSlug, RBAC_LEVELS.EDITOR);

  const rows = await db
    .select({
      id: evidenceGrades.id,
      userId: evidenceGrades.userId,
      skillId: evidenceGrades.skillId,
      kind: evidenceGrades.kind,
      score: evidenceGrades.score,
    })
    .from(evidenceGrades)
    .where(
      and(eq(evidenceGrades.id, parsed.gradeId), eq(evidenceGrades.workspaceId, ws.id)),
    )
    .limit(1);

  const grade = rows[0];
  if (!grade) throw new Error('EVIDENCE_NOT_FOUND');

  await db
    .update(evidenceGrades)
    .set({
      reviewerUserId: user.id,
      reviewedAt: new Date(),
      note: parsed.note ?? null,
    })
    .where(eq(evidenceGrades.id, grade.id));

  await db.insert(skillAuditLog).values({
    workspaceId: ws.id,
    userId: grade.userId,
    skillId: grade.skillId,
    action: 'verified',
    fromValue: null,
    toValue: parsed.approved ? 'approved' : 'rejected',
    reason: parsed.note ?? null,
    actorUserId: user.id,
  });

  await db.insert(activityLog).values({
    workspaceId: ws.id,
    userId: user.id,
    kind: 'evidence_reviewed',
    payload: {
      gradeId: grade.id,
      targetUserId: grade.userId,
      skillId: grade.skillId,
      approved: parsed.approved,
    },
  });

  await writeAudit({
    workspaceId: ws.id,
    actorUserId: user.id,
    actorRole: ctx.role,
    action: 'evidence.verify',
    resourceType: 'evidence_grade',
    resourceId: grade.id,
    before: null,
    after: {
      targetUserId: grade.userId,
      skillId: grade.skillId,
      approved: parsed.approved,
    },
  });

  revalidatePath(`/w/${ws.slug}`);
  revalidatePath(`/w/${ws.slug}/skills`);
  return { ok: true };
}

/* ============================ COMPUTE CONFIDENCE ============================ */

/**
 * Public wrapper around the pure helper — queries all grades for the current
 * user's (workspace, skill) and returns the aggregated confidence + source.
 */
export async function computeConfidence(
  workspaceSlug: string,
  skillId: string,
): Promise<ConfidenceResult> {
  const { ws, user } = await resolveWorkspace(workspaceSlug, RBAC_LEVELS.LEARNER);
  const parsedSkillId = z.string().uuid().parse(skillId);
  await assertSkillInWorkspace(parsedSkillId, ws.id);

  const grades = await db
    .select({ kind: evidenceGrades.kind, score: evidenceGrades.score })
    .from(evidenceGrades)
    .where(
      and(
        eq(evidenceGrades.workspaceId, ws.id),
        eq(evidenceGrades.userId, user.id),
        eq(evidenceGrades.skillId, parsedSkillId),
      ),
    );

  return computeConfidenceFromGrades(grades);
}

/** Convenience re-export so callers can read kinds without pulling schema-v8. */
export type { EvidenceKind, ConfidenceResult };
