/**
 * Badge evaluator — called after major mutations (completeLesson, updateAssessment).
 * Returns badges newly granted in this evaluation pass.
 */
import { and, eq, count, sum, inArray, isNotNull } from 'drizzle-orm';
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
    .where(eq(badges.workspaceId, workspaceId));

  const owned = await db
    .select({ badgeId: userBadges.badgeId })
    .from(userBadges)
    .where(and(eq(userBadges.workspaceId, workspaceId), eq(userBadges.userId, userId)));
  const ownedSet = new Set(owned.map((r) => r.badgeId));

  const granted: GrantedBadge[] = [];

  for (const b of allBadges) {
    if (ownedSet.has(b.id)) continue;
    const rule = b.rule as BadgeRule | null;
    if (!rule) continue;

    let pass = false;
    try {
      pass = await evalRule(workspaceId, userId, rule);
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

async function evalRule(
  workspaceId: string,
  userId: string,
  rule: BadgeRule,
): Promise<boolean> {
  switch (rule.kind) {
    case 'lesson_completed': {
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
      return (r?.n ?? 0) >= rule.value;
    }

    case 'week_completed': {
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
      return (r?.n ?? 0) >= rule.value;
    }

    case 'level_completed': {
      const rows = await db
        .select()
        .from(userLevelProgress)
        .where(
          and(
            eq(userLevelProgress.workspaceId, workspaceId),
            eq(userLevelProgress.userId, userId),
            eq(userLevelProgress.levelCode, rule.value),
          ),
        )
        .limit(1);
      return rows[0]?.status === 'completed';
    }

    case 'streak': {
      const rows = await db
        .select()
        .from(streaks)
        .where(and(eq(streaks.workspaceId, workspaceId), eq(streaks.userId, userId)))
        .limit(1);
      return (rows[0]?.currentStreak ?? 0) >= rule.value;
    }

    case 'crowns_total': {
      const [r] = await db
        .select({ s: sum(userSkillProgress.crowns) })
        .from(userSkillProgress)
        .where(
          and(
            eq(userSkillProgress.workspaceId, workspaceId),
            eq(userSkillProgress.userId, userId),
          ),
        );
      return Number(r?.s ?? 0) >= rule.value;
    }

    case 'total_xp': {
      const [r] = await db
        .select({ s: sum(xpEvents.amount) })
        .from(xpEvents)
        .where(
          and(
            eq(xpEvents.workspaceId, workspaceId),
            eq(xpEvents.userId, userId),
          ),
        );
      return Number(r?.s ?? 0) >= rule.value;
    }

    case 'all_skills_assessed': {
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
      return totalSkills > 0 && assessed >= totalSkills;
    }

    case 'category_level': {
      // All skills in category X must have level >= level numeric value.
      const [lvl] = await db
        .select({ num: competencyLevels.numericValue })
        .from(competencyLevels)
        .where(
          and(
            eq(competencyLevels.workspaceId, workspaceId),
            eq(competencyLevels.code, rule.level),
          ),
        )
        .limit(1);
      if (!lvl) return false;

      const catRows = await db
        .select({ id: skillCategories.id })
        .from(skillCategories)
        .where(
          and(
            eq(skillCategories.workspaceId, workspaceId),
            eq(skillCategories.slug, rule.category),
          ),
        )
        .limit(1);
      const cat = catRows[0];
      if (!cat) return false;

      const allSkillsInCat = await db
        .select({ id: skills.id })
        .from(skills)
        .where(and(eq(skills.workspaceId, workspaceId), eq(skills.categoryId, cat.id)));
      if (allSkillsInCat.length === 0) return false;

      const progress = await db
        .select({ skillId: userSkillProgress.skillId, levelCode: userSkillProgress.levelCode })
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
      const allLevels = await db
        .select({ code: competencyLevels.code, num: competencyLevels.numericValue })
        .from(competencyLevels)
        .where(eq(competencyLevels.workspaceId, workspaceId));
      const numByCode = new Map(allLevels.map((l) => [l.code, l.num]));

      if (progress.length < allSkillsInCat.length) return false;
      return progress.every((p) => {
        const n = p.levelCode ? numByCode.get(p.levelCode) ?? -1 : -1;
        return n >= lvl.num;
      });
    }
  }
}
