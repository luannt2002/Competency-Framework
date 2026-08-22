/**
 * Hàng đợi duyệt bằng chứng kỹ năng (EDITOR+).
 *
 * Vì sao cần: `verifyEvidence` có đủ logic từ lâu nhưng nguồn dữ liệu duy nhất
 * dẫn tới nó là `listEvidenceForSkill`, mà hàm đó lọc theo *người đang xem* —
 * nên nút "Duyệt" trong drawer kỹ năng chỉ duyệt được đồ của chính mình
 * (rà D4.7). Sửa xong phần chặn tự-duyệt thì màn duyệt trở nên **rỗng**: người
 * duyệt không có đường nào nhìn thấy bằng chứng của người khác.
 *
 * Đặt cạnh hàng đợi chấm bài thay vì dựng route mới: cùng một việc (người có
 * quyền xử lý thứ đang chờ), cùng một cấp quyền, và một route nữa là một route
 * nữa có nguy cơ không ai trỏ tới.
 */
import { and, asc, eq, isNull, ne, count } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { evidenceGrades, skills, userSkillProgress } from '@/lib/db/schema';

export type PendingEvidence = {
  gradeId: string;
  userId: string;
  skillId: string;
  skillName: string;
  /** Bậc người học đang tự nhận cho kỹ năng này, để người duyệt có ngữ cảnh. */
  levelCode: string | null;
  kind: string;
  score: number;
  evidenceUrl: string | null;
  note: string | null;
  createdAt: Date;
};

/**
 * Bằng chứng đang chờ duyệt, cũ nhất trước.
 *
 * `excludeUserId` là người đang xem: đồ của chính họ không được hiện, vì
 * `verifyEvidence` sẽ từ chối với `CANNOT_VERIFY_OWN_EVIDENCE` — hiện ra rồi
 * bấm vào mới báo lỗi là hàng đợi nói dối.
 */
export async function listPendingEvidence(
  workspaceId: string,
  excludeUserId: string,
  limit = 50,
): Promise<PendingEvidence[]> {
  const rows = await db
    .select({
      gradeId: evidenceGrades.id,
      userId: evidenceGrades.userId,
      skillId: evidenceGrades.skillId,
      skillName: skills.name,
      levelCode: userSkillProgress.levelCode,
      kind: evidenceGrades.kind,
      score: evidenceGrades.score,
      evidenceUrl: evidenceGrades.evidenceUrl,
      note: evidenceGrades.note,
      createdAt: evidenceGrades.createdAt,
    })
    .from(evidenceGrades)
    .innerJoin(skills, eq(evidenceGrades.skillId, skills.id))
    // Join theo ĐỦ ba khoá. Nối chỉ bằng workspaceId sẽ nhân dòng theo số bậc
    // năng lực của workspace — một bằng chứng hiện ra 4 lần.
    .leftJoin(
      userSkillProgress,
      and(
        eq(userSkillProgress.workspaceId, evidenceGrades.workspaceId),
        eq(userSkillProgress.userId, evidenceGrades.userId),
        eq(userSkillProgress.skillId, evidenceGrades.skillId),
      ),
    )
    .where(
      and(
        eq(evidenceGrades.workspaceId, workspaceId),
        isNull(evidenceGrades.reviewedAt),
        ne(evidenceGrades.userId, excludeUserId),
      ),
    )
    .orderBy(asc(evidenceGrades.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    gradeId: r.gradeId,
    userId: r.userId,
    skillId: r.skillId,
    skillName: r.skillName,
    levelCode: r.levelCode ?? null,
    kind: r.kind,
    score: r.score,
    evidenceUrl: r.evidenceUrl,
    note: r.note,
    createdAt: r.createdAt ?? new Date(0),
  }));
}

/** Đếm để hiện số trên nhãn hàng đợi. */
export async function countPendingEvidence(
  workspaceId: string,
  excludeUserId: string,
): Promise<number> {
  const rows = await db
    .select({ n: count() })
    .from(evidenceGrades)
    .where(
      and(
        eq(evidenceGrades.workspaceId, workspaceId),
        isNull(evidenceGrades.reviewedAt),
        ne(evidenceGrades.userId, excludeUserId),
      ),
    );
  return Number(rows[0]?.n ?? 0);
}
