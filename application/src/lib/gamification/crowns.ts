/**
 * Crown grant logic — called after a lesson is completed.
 *
 * Rule:
 *   For every skill linked to this lesson via lesson_skill_map:
 *     - On FIRST completion of the lesson: crowns += 1 (mastered: += 2).
 *     - On first MASTERY upgrade of an already-completed lesson: crowns += 1.
 *     - Cap at 5.
 *   Replaying an already-completed/mastered lesson grants nothing (eligibility
 *   is decided by the caller from the user_lesson_progress status transition).
 *   Also if user has no progress row yet for that skill, create with level_source='learned'.
 */
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import {
  lessonSkillMap,
  userSkillProgress,
} from '@/lib/db/schema';

export type CrownAdvance = {
  skillId: string;
  newCrowns: number;
  delta: number;
};

export async function awardCrowns(
  workspaceId: string,
  userId: string,
  lessonId: string,
  mastered: boolean,
  opts: { eligible: boolean; masteredUpgrade?: boolean } = { eligible: true },
): Promise<CrownAdvance[]> {
  // Not a real status transition (replay of a finished lesson) → no crowns.
  if (!opts.eligible) return [];

  const links = await db
    .select({
      skillId: lessonSkillMap.skillId,
      contributesToLevel: lessonSkillMap.contributesToLevel,
    })
    .from(lessonSkillMap)
    .where(eq(lessonSkillMap.lessonId, lessonId));

  const advances: CrownAdvance[] = [];

  for (const link of links) {
    // First completion: mastered counts double. A completed → mastered upgrade: +1.
    const incrementBy = opts.masteredUpgrade ? 1 : mastered ? 2 : 1;

    // Khoá hàng rồi mới cộng — không đọc-rồi-ghi ngoài transaction.
    //
    // Bản cũ SELECT crowns, cộng trong JS, rồi UPDATE đè. Hai tab hoàn thành
    // bài cùng lúc đọc được cùng một số, cộng ra cùng một kết quả, ghi đè lên
    // nhau — mất một lượt vương miện. Nhánh `insert` còn tệ hơn: hai lượt song
    // song cùng thấy "chưa có dòng" rồi cùng insert, đâm vào
    // `usp_ws_user_skill_uq`.
    //
    // `FOR UPDATE` giữ khoá tới hết transaction nên lượt thứ hai phải chờ và
    // đọc được số đã cập nhật. Hàng chưa tồn tại thì không có gì để khoá, nên
    // phần chèn vẫn dựa vào `onConflictDoUpdate` — cuộc đua chèn rơi vào nhánh
    // cập nhật thay vì nổ ràng buộc.
    //
    // Cần `FOR UPDATE` chứ không chỉ upsert vì `delta` phải tính từ giá trị CŨ,
    // mà Postgres 16 chưa có `RETURNING OLD.*` (mới có ở 18). Suy ngược từ số
    // mới cũng không được: khi chạm trần 5 thì cũ=4 và cũ=3 đều cho mới=5.
    const advance = await db.transaction(async (tx) => {
      const locked = await tx
        .select({ crowns: userSkillProgress.crowns })
        .from(userSkillProgress)
        .where(
          and(
            eq(userSkillProgress.workspaceId, workspaceId),
            eq(userSkillProgress.userId, userId),
            eq(userSkillProgress.skillId, link.skillId),
          ),
        )
        .limit(1)
        .for('update');

      const oldCrowns = locked[0]?.crowns ?? 0;

      const [row] = await tx
        .insert(userSkillProgress)
        .values({
          workspaceId,
          userId,
          skillId: link.skillId,
          crowns: Math.min(5, incrementBy),
          levelSource: 'learned',
        })
        .onConflictDoUpdate({
          target: [
            userSkillProgress.workspaceId,
            userSkillProgress.userId,
            userSkillProgress.skillId,
          ],
          set: {
            crowns: sql`LEAST(5, COALESCE(${userSkillProgress.crowns}, 0) + ${incrementBy})`,
            // Viết lại `nextLevelSource(prev, 'learn')` bằng CASE. Ba nhánh phải
            // khớp đúng hàm đó — có test đối chiếu từng giá trị enum để hai bản
            // không lệch nhau về sau.
            levelSource: sql`
              CASE
                WHEN ${userSkillProgress.levelSource} = 'verified' THEN 'verified'
                WHEN ${userSkillProgress.levelSource} IN ('self_claimed', 'both') THEN 'both'
                ELSE 'learned'
              END::level_source`,
            updatedAt: new Date(),
          },
        })
        .returning({ crowns: userSkillProgress.crowns });

      const newCrowns = row?.crowns ?? oldCrowns;
      return { newCrowns, delta: newCrowns - oldCrowns };
    });

    if (advance.delta === 0) continue;
    advances.push({
      skillId: link.skillId,
      newCrowns: advance.newCrowns,
      delta: advance.delta,
    });
  }

  return advances;
}
