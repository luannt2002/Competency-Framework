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
import { resolveWorkspace } from '@/lib/rbac/resolve';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import {
  skills,
  userSkillProgress,
  activityLog,
} from '@/lib/db/schema';
import {
  evidenceGrades,
  skillAuditLog,
  type EvidenceKind,
  type EvidenceGrade,
} from '@/lib/db/schema-v8';
import {
  computeConfidenceFromGrades,
  VERIFIED_MIN_SCORE,
  type ConfidenceResult,
} from '@/lib/evidence/confidence';
import { RBAC_LEVELS } from '@/lib/rbac/levels';
import { nextLevelSource } from '@/lib/skills/level-source';
import { writeAudit } from '@/lib/rbac/server';
import { XP } from '@/lib/learn/xp-rules';
import { insertXpOnce } from '@/lib/learn/xp-award';

/* ============================ HELPERS ============================ */


async function assertSkillInWorkspace(skillId: string, workspaceId: string) {
  const rows = await db
    .select({ id: skills.id })
    .from(skills)
    .where(and(eq(skills.id, skillId), eq(skills.workspaceId, workspaceId)))
    .limit(1);
  if (!rows[0]) throw new Error('SKILL_NOT_IN_WORKSPACE');
}

/* ============================ SUBMIT EVIDENCE ============================ */

/**
 * Chỉ nhận dạng bằng chứng TỰ LÀM.
 *
 * `submitEvidence` luôn ghi `userId: user.id` — nó là đường tự nộp, không có
 * biến thể nộp hộ. Nên `peer_review` / `manager_review` không được xuất hiện ở
 * đây: chúng mô tả việc NGƯỜI KHÁC đã xem xét, mà người khác thì không đi qua
 * hàm này.
 *
 * Trước đợt này enum nhận cả bốn, và dòng ghi `reviewerUserId` đặt chính người
 * nộp làm người duyệt. Hậu quả: một learner mở drawer kỹ năng, chọn
 * "Manager review", nhập 100, bấm gửi → `hasManager` thành true → kỹ năng lên
 * thẳng `verified`, và `nextLevelSource` quy định `verified` không sự kiện
 * thường nào hạ được, nên trạng thái tự phong đó là VĨNH VIỄN. Toàn bộ roster,
 * export XLSX/PDF và ma trận năng lực hiển thị "đã được duyệt" trong khi không
 * ai duyệt cả.
 *
 * Chốt chặn ở `verifyEvidence` ("KHÔNG ai được tự duyệt bằng chứng của chính
 * mình") bị đi vòng hoàn toàn qua cửa này. Chặn ngay ở biên: trạng thái sai
 * không biểu diễn được thì không cần kiểm ở dưới.
 */
const submitInput = z.object({
  workspaceSlug: z.string().min(1),
  skillId: z.string().uuid(),
  kind: z.enum(['lab', 'project']),
  score: z.number().int().min(0).max(100),
  evidenceUrl: z.string().url().max(2_000).optional(),
  note: z.string().max(5_000).optional(),
});

export type SubmitEvidenceInput = z.infer<typeof submitInput>;

/**
 * Dạng bằng chứng người học TỰ NỘP được — hẹp hơn `EvidenceKind` của DB.
 *
 * DB vẫn giữ đủ bốn dạng vì những hàng `peer_review` / `manager_review` cũ còn
 * đó và phép tính độ tin cậy vẫn phải đọc chúng. Nhưng biểu mẫu tự nộp chỉ
 * được phép sinh ra hai dạng này. Lấy kiểu thẳng từ schema đầu vào để form và
 * server không bao giờ lệch nhau: siết enum ở một chỗ là typecheck bắt luôn
 * mọi chỗ còn lại.
 */
export type SelfEvidenceKind = SubmitEvidenceInput['kind'];

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

  // Bằng chứng tự nộp thì CHƯA có người duyệt. Ô người duyệt chỉ được điền ở
  // `verifyEvidence`, nơi có chốt `grade.userId !== user.id`.
  const inserted = await db
    .insert(evidenceGrades)
    .values({
      workspaceId: ws.id,
      userId: user.id,
      skillId: parsed.skillId,
      kind: parsed.kind,
      score: parsed.score,
      evidenceUrl: parsed.evidenceUrl,
      reviewerUserId: null,
      reviewedAt: null,
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

  const confidence = computeConfidenceFromGrades(
    allGrades as { kind: Parameters<typeof computeConfidenceFromGrades>[0][number]['kind']; score: number }[],
  );
  // Tự nộp KHÔNG bao giờ nâng lên `verified`.
  //
  // Trước đợt này chỗ này là `hasManager && score >= VERIFIED_MIN_SCORE`, mà
  // `hasManager` lại đọc chính những hàng do người dùng tự nộp — nên tự phong
  // được. Chặn ở enum đầu vào là chưa đủ: những hàng `manager_review` do lỗ
  // hổng cũ để lại vẫn còn trong DB, và phép đếm này sẽ tiếp tục nâng cấp cho
  // họ ở lần nộp kế tiếp. Đường duy nhất lên `verified` là `verifyEvidence`.
  const shouldVerify = false;

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
  // Cùng quy tắc với assessments.ts và crowns.ts — xem lib/skills/level-source.ts.
  const nextSource = nextLevelSource(prevSource, shouldVerify ? 'verify' : 'learn');

  if (existing[0]) {
    await db
      .update(userSkillProgress)
      .set({ levelSource: nextSource, updatedAt: new Date() })
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

/**
 * Bằng chứng của một kỹ năng.
 *
 * `subjectUserId` mặc định là chính người gọi. Truyền người khác thì phải từ
 * EDITOR trở lên — đây là đường DUY NHẤT để người duyệt nhìn thấy bằng chứng
 * cần duyệt. Trước đây hàm này ghim cứng `userId = người đang xem`, nên màn
 * duyệt chỉ hiện đồ của chính người duyệt (rà D4.7).
 */
export async function listEvidenceForSkill(
  workspaceSlug: string,
  skillId: string,
  subjectUserId?: string,
): Promise<EvidenceRow[]> {
  const { ws, user, ctx } = await resolveWorkspace(workspaceSlug, RBAC_LEVELS.LEARNER);

  // Lightweight UUID shape check — Zod for symmetry with mutations.
  const parsed = z.string().uuid().parse(skillId);
  await assertSkillInWorkspace(parsed, ws.id);

  const subject = subjectUserId ? z.string().uuid().parse(subjectUserId) : user.id;
  // Xem bằng chứng của người khác là hành vi của người duyệt, không phải người học.
  if (subject !== user.id && ctx.level < RBAC_LEVELS.EDITOR) {
    throw new Error('WORKSPACE_NOT_FOUND_OR_FORBIDDEN');
  }

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
        eq(evidenceGrades.userId, subject),
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

  // KHÔNG ai được tự duyệt bằng chứng của chính mình.
  //
  // Rà D4.7 đo được: `listEvidenceForSkill` lọc theo `userId = người đang xem`,
  // nên mọi bằng chứng hiện ra trong drawer đều là của chính họ — nút "Duyệt"
  // chỉ tự duyệt cho mình, và vẫn cộng +30 XP. Bất kỳ ai đạt EDITOR trở lên là
  // tự phong `verified` cho mọi kỹ năng của mình được. Cấp bậc không thay thế
  // được sự tách bạch giữa người làm và người duyệt.
  if (grade.userId === user.id) throw new Error('CANNOT_VERIFY_OWN_EVIDENCE');

  await db
    .update(evidenceGrades)
    .set({
      reviewerUserId: user.id,
      reviewedAt: new Date(),
      note: parsed.note ?? null,
    })
    .where(and(eq(evidenceGrades.id, grade.id), eq(evidenceGrades.workspaceId, ws.id)));

  // Duyệt xong thì NÂNG kỹ năng của chủ bằng chứng lên `verified`.
  //
  // Trước đợt này `nextLevelSource(..., 'verify')` chỉ được gọi ở
  // `submitEvidence` — tức đường TỰ NỘP là đường duy nhất lên được `verified`,
  // còn hàm này (đường duyệt thật, có chốt `grade.userId !== user.id` và đòi
  // EDITOR) thì không hề đụng tới `userSkillProgress`. Kiến trúc bị lộn ngược:
  // cửa có khoá thì không dẫn đi đâu, cửa dẫn tới đích thì không có khoá.
  //
  // Đặt phép nâng cấp vào đây là trả nó về đúng chỗ: chỉ người KHÁC, từ EDITOR
  // trở lên, mới phong `verified` được.
  if (parsed.approved) {
    // Ngưỡng điểm vẫn giữ nguyên như đặc tả ở lib/evidence/confidence.ts:
    // "đã có người duyệt VÀ điểm tổng hợp >= 70 -> verified". Cái đổi chỗ là
    // vế đầu: trước đây "đã có người duyệt" được suy ra từ một hàng
    // `manager_review` mà chính chủ tự nộp; giờ nó là hành động duyệt thật của
    // một người khác, đã qua chốt `grade.userId !== user.id` ở trên.
    const ownerGrades = await db
      .select({ kind: evidenceGrades.kind, score: evidenceGrades.score })
      .from(evidenceGrades)
      .where(
        and(
          eq(evidenceGrades.workspaceId, ws.id),
          eq(evidenceGrades.userId, grade.userId),
          eq(evidenceGrades.skillId, grade.skillId),
        ),
      );

    const confidence = computeConfidenceFromGrades(
      ownerGrades as {
        kind: Parameters<typeof computeConfidenceFromGrades>[0][number]['kind'];
        score: number;
      }[],
    );

    if (confidence.score >= VERIFIED_MIN_SCORE) {
      const existing = await db
        .select({ id: userSkillProgress.id, levelSource: userSkillProgress.levelSource })
        .from(userSkillProgress)
        .where(
          and(
            eq(userSkillProgress.workspaceId, ws.id),
            eq(userSkillProgress.userId, grade.userId),
            eq(userSkillProgress.skillId, grade.skillId),
          ),
        )
        .limit(1);

      if (existing[0]) {
        await db
          .update(userSkillProgress)
          .set({
            levelSource: nextLevelSource(existing[0].levelSource ?? null, 'verify'),
            updatedAt: new Date(),
          })
          // Mang theo `workspaceId` dù `id` đã đủ định danh: câu select ở trên
          // có lọc tenant, nhưng câu update thì phải TỰ nó an toàn — người đọc
          // sau này không nên phải lần ngược lên mới biết nó có bị rò không.
          .where(
            and(
              eq(userSkillProgress.id, existing[0].id),
              eq(userSkillProgress.workspaceId, ws.id),
            ),
          );
      }
    }
  }

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

  // F5 — approving evidence pays the skill owner a one-off +30 XP.
  // Dedupe key: (workspace, owner, refKind='skill', refId=skillId, reason='skill_verified')
  // so re-verifying (or approving another grade on the same skill) never double-awards.
  if (parsed.approved) {
    await insertXpOnce({
      workspaceId: ws.id,
      userId: grade.userId,
      amount: XP.SKILL_VERIFIED,
      reason: 'skill_verified',
      refKind: 'skill',
      refId: grade.skillId,
    });
  }

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

  // kind giờ là text (enum nới 0013) — ep về union mà hàm confidence chấp nhận
  return computeConfidenceFromGrades(grades as Parameters<typeof computeConfidenceFromGrades>[0]);
}

/** Convenience re-export so callers can read kinds without pulling schema-v8. */
export type { EvidenceKind, ConfidenceResult };
