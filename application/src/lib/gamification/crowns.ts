/**
 * Crown grant logic — called after a lesson is completed.
 *
 * Rule (MVP simplified):
 *   For every skill linked to this lesson via lesson_skill_map:
 *     - On first 'completed' lesson for that skill: crowns += 1 (max 5).
 *     - On a 'mastered' completion of a lesson already marked 'completed': crowns += 1.
 *     - Cap at 5.
 *   Also if user has no progress row yet for that skill, create with level_source='learned'.
 */
import { and, eq, sql as dsql } from 'drizzle-orm';
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
): Promise<CrownAdvance[]> {
  const links = await db
    .select({
      skillId: lessonSkillMap.skillId,
      contributesToLevel: lessonSkillMap.contributesToLevel,
    })
    .from(lessonSkillMap)
    .where(eq(lessonSkillMap.lessonId, lessonId));

  const advances: CrownAdvance[] = [];

  for (const link of links) {
    const existing = await db
      .select({
        id: userSkillProgress.id,
        crowns: userSkillProgress.crowns,
        levelCode: userSkillProgress.levelCode,
        levelSource: userSkillProgress.levelSource,
      })
      .from(userSkillProgress)
      .where(
        and(
          eq(userSkillProgress.workspaceId, workspaceId),
          eq(userSkillProgress.userId, userId),
          eq(userSkillProgress.skillId, link.skillId),
        ),
      )
      .limit(1);

    const incrementBy = mastered ? 2 : 1; // mastered worth a bit more
    const oldCrowns = existing[0]?.crowns ?? 0;
    const newCrowns = Math.min(5, oldCrowns + incrementBy);
    const delta = newCrowns - oldCrowns;
    if (delta === 0) continue;

    // Compute level_source: if user had self_claimed and now learning, mark 'both'.
    // If no prior level, leave null (user must still self-assess) but bump crowns.
    const newSource =
      existing[0]?.levelSource === 'self_claimed'
        ? ('both' as const)
        : ('learned' as const);

    if (existing[0]) {
      await db
        .update(userSkillProgress)
        .set({
          crowns: newCrowns,
          levelSource: newSource,
          updatedAt: new Date(),
        })
        .where(eq(userSkillProgress.id, existing[0].id));
    } else {
      await db.insert(userSkillProgress).values({
        workspaceId,
        userId,
        skillId: link.skillId,
        crowns: newCrowns,
        levelSource: 'learned',
      });
    }

    advances.push({ skillId: link.skillId, newCrowns, delta });
  }

  return advances;
}
