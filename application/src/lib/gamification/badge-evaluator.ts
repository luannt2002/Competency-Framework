/**
 * Badge evaluator — called after major mutations (completeLesson, updateAssessment).
 * Returns badges newly granted in this evaluation pass.
 */
import { and, eq, count, sum, inArray, isNotNull, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import {
  badges,
  userBadges,
  userLessonProgress,
  userLevelProgress,
  userSkillProgress,
  userWeekProgress,
  streaks,
  xpEvents,
  skills,
  skillCategories,
  competencyLevels,
} from '@/lib/db/schema';
import { XP } from '@/lib/learn/xp-rules';

export type GrantedBadge = {
  badgeId: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
};

type BadgeRule =
  | { kind: 'lesson_completed'; value: number }
  | { kind: 'week_completed'; value: number }
  | { kind: 'level_completed'; value: string }
  | { kind: 'streak'; value: number }
  | { kind: 'crowns_total'; value: number }
  | { kind: 'category_level'; category: string; level: string }
  | { kind: 'all_skills_assessed' }
  | { kind: 'total_xp'; value: number };

export async function evaluateBadges(
  workspaceId: string,
  userId: string,
): Promise<GrantedBadge[]> {
  const allBadges = await db
    .select()
    .from(badges)
    // F16 — deactivated badges stop being granted; earned rows are untouched.
    .where(and(eq(badges.workspaceId, workspaceId), sql`badges.is_active`));

  const owned = await db
    .select({ badgeId: userBadges.badgeId })
    .from(userBadges)
    .where(and(eq(userBadges.workspaceId, workspaceId), eq(userBadges.userId, userId)));
  const ownedSet = new Set(owned.map((r) => r.badgeId));

  const granted: GrantedBadge[] = [];

  // Một bộ đếm dùng chung cho cả vòng lặp: mỗi phép tổng hợp chạy nhiều nhất
  // một lần, thay vì một lần cho mỗi huy hiệu.
  const stats = createBadgeStats(workspaceId, userId);

  for (const b of allBadges) {
    if (ownedSet.has(b.id)) continue;
    const rule = b.rule as BadgeRule | null;
    if (!rule) continue;

    let pass = false;
    try {
      pass = await evalRule(stats, rule);
    } catch {
      pass = false;
    }
    if (!pass) continue;

    await db.insert(userBadges).values({
      workspaceId,
      userId,
      badgeId: b.id,
    });

    // Award XP for badge earned
    await db.insert(xpEvents).values({
      workspaceId,
      userId,
      amount: XP.BADGE_EARNED,
      reason: 'badge_earned',
      refKind: 'badge',
      refId: b.id,
    });

    granted.push({
      badgeId: b.id,
      slug: b.slug,
      name: b.name,
      description: b.description,
      icon: b.icon,
    });
  }

  return granted;
}

/**
 * Bộ đếm dùng chung cho MỘT lượt đánh giá huy hiệu.
 *
 * Vì sao cần: `evalRule` cũ tự truy vấn cho từng huy hiệu, mà phần lớn luật
 * tính CÙNG MỘT phép tổng hợp và chỉ khác ngưỡng — ba huy hiệu
 * `lesson_completed` ở mốc 1/5/10 chạy ba lần y hệt một câu đếm. Workspace mẫu
 * có 12 huy hiệu, mỗi luật 1-5 truy vấn, và `evaluateBadges` được gọi ở cả
 * `completeLesson` lẫn mỗi lần cập nhật tiến độ node — hai đường nóng nhất của
 * người học.
 *
 * Ở đây mỗi phép tổng hợp chạy NHIỀU NHẤT MỘT LẦN cho mỗi lượt gọi, và chỉ
 * chạy khi thật sự có luật cần tới nó (lười). Đệm sống đúng một lượt gọi nên
 * không có chuyện đọc phải số cũ giữa hai lần đánh giá.
 */
function createBadgeStats(workspaceId: string, userId: string) {
  const cache = new Map<string, Promise<unknown>>();

  function once<T>(key: string, run: () => Promise<T>): Promise<T> {
    const hit = cache.get(key);
    if (hit) return hit as Promise<T>;
    const p = run();
    cache.set(key, p);
    return p;
  }

  return {
    lessonsCompleted: () =>
      once('lessonsCompleted', async () => {
        const [r] = await db
          .select({ n: count() })
          .from(userLessonProgress)
          .where(
            and(
              eq(userLessonProgress.workspaceId, workspaceId),
              eq(userLessonProgress.userId, userId),
              inArray(userLessonProgress.status, ['completed', 'mastered']),
            ),
          );
        return r?.n ?? 0;
      }),

    weeksCompleted: () =>
      once('weeksCompleted', async () => {
        const [r] = await db
          .select({ n: count() })
          .from(userWeekProgress)
          .where(
            and(
              eq(userWeekProgress.workspaceId, workspaceId),
              eq(userWeekProgress.userId, userId),
              isNotNull(userWeekProgress.completedAt),
            ),
          );
        return r?.n ?? 0;
      }),

    currentStreak: () =>
      once('currentStreak', async () => {
        const rows = await db
          .select({ currentStreak: streaks.currentStreak })
          .from(streaks)
          .where(and(eq(streaks.workspaceId, workspaceId), eq(streaks.userId, userId)))
          .limit(1);
        return rows[0]?.currentStreak ?? 0;
      }),

    crownsTotal: () =>
      once('crownsTotal', async () => {
        const [r] = await db
          .select({ s: sum(userSkillProgress.crowns) })
          .from(userSkillProgress)
          .where(
            and(
              eq(userSkillProgress.workspaceId, workspaceId),
              eq(userSkillProgress.userId, userId),
            ),
          );
        return Number(r?.s ?? 0);
      }),

    totalXp: () =>
      once('totalXp', async () => {
        const [r] = await db
          .select({ s: sum(xpEvents.amount) })
          .from(xpEvents)
          .where(and(eq(xpEvents.workspaceId, workspaceId), eq(xpEvents.userId, userId)));
        return Number(r?.s ?? 0);
      }),

    /** Trạng thái một mốc trình độ — đệm riêng theo mã, vì luật khác mã khác nhau. */
    levelStatus: (code: string) =>
      once(`level:${code}`, async () => {
        const rows = await db
          .select({ status: userLevelProgress.status })
          .from(userLevelProgress)
          .where(
            and(
              eq(userLevelProgress.workspaceId, workspaceId),
              eq(userLevelProgress.userId, userId),
              eq(userLevelProgress.levelCode, code),
            ),
          )
          .limit(1);
        return rows[0]?.status ?? null;
      }),

    skillCounts: () =>
      once('skillCounts', async () => {
        const [{ totalSkills } = { totalSkills: 0 }] = await db
          .select({ totalSkills: count() })
          .from(skills)
          .where(eq(skills.workspaceId, workspaceId));
        const [{ assessed } = { assessed: 0 }] = await db
          .select({ assessed: count() })
          .from(userSkillProgress)
          .where(
            and(
              eq(userSkillProgress.workspaceId, workspaceId),
              eq(userSkillProgress.userId, userId),
              isNotNull(userSkillProgress.levelCode),
            ),
          );
        return { totalSkills, assessed };
      }),

    /** Bảng mã trình độ → giá trị số. Mọi luật `category_level` dùng chung. */
    levelNumByCode: () =>
      once('levelNumByCode', async () => {
        const rows = await db
          .select({ code: competencyLevels.code, num: competencyLevels.numericValue })
          .from(competencyLevels)
          .where(eq(competencyLevels.workspaceId, workspaceId));
        return new Map(rows.map((l) => [l.code, l.num]));
      }),

    /** Kỹ năng của một nhóm + mức hiện tại của người học — đệm theo slug nhóm. */
    categoryProgress: (categorySlug: string) =>
      once(`cat:${categorySlug}`, async () => {
        const catRows = await db
          .select({ id: skillCategories.id })
          .from(skillCategories)
          .where(
            and(
              eq(skillCategories.workspaceId, workspaceId),
              eq(skillCategories.slug, categorySlug),
            ),
          )
          .limit(1);
        const cat = catRows[0];
        if (!cat) return null;

        const allSkillsInCat = await db
          .select({ id: skills.id })
          .from(skills)
          .where(and(eq(skills.workspaceId, workspaceId), eq(skills.categoryId, cat.id)));
        if (allSkillsInCat.length === 0) return null;

        const progress = await db
          .select({
            skillId: userSkillProgress.skillId,
            levelCode: userSkillProgress.levelCode,
          })
          .from(userSkillProgress)
          .where(
            and(
              eq(userSkillProgress.workspaceId, workspaceId),
              eq(userSkillProgress.userId, userId),
              inArray(
                userSkillProgress.skillId,
                allSkillsInCat.map((s) => s.id),
              ),
            ),
          );
        return { totalSkills: allSkillsInCat.length, progress };
      }),
  };
}

type BadgeStats = ReturnType<typeof createBadgeStats>;

async function evalRule(
  stats: BadgeStats,
  rule: BadgeRule,
): Promise<boolean> {
  switch (rule.kind) {
    case 'lesson_completed':
      return (await stats.lessonsCompleted()) >= rule.value;

    case 'week_completed':
      return (await stats.weeksCompleted()) >= rule.value;

    case 'level_completed':
      return (await stats.levelStatus(rule.value)) === 'completed';

    case 'streak':
      return (await stats.currentStreak()) >= rule.value;

    case 'crowns_total':
      return (await stats.crownsTotal()) >= rule.value;

    case 'total_xp':
      return (await stats.totalXp()) >= rule.value;

    case 'all_skills_assessed': {
      const { totalSkills, assessed } = await stats.skillCounts();
      return totalSkills > 0 && assessed >= totalSkills;
    }

    case 'category_level': {
      // Mọi kỹ năng trong nhóm phải đạt mức >= giá trị số của `rule.level`.
      const numByCode = await stats.levelNumByCode();
      const target = numByCode.get(rule.level);
      if (target === undefined || target === null) return false;

      const cat = await stats.categoryProgress(rule.category);
      if (!cat) return false;
      if (cat.progress.length < cat.totalSkills) return false;

      return cat.progress.every((p) => {
        const n = p.levelCode ? numByCode.get(p.levelCode) ?? -1 : -1;
        return n >= target;
      });
    }
  }
}
