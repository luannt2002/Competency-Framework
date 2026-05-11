// @ts-nocheck -- one-off CLI bootstrap; payload typed as any from JSON parse
/**
 * Bootstrap full DevOps content into an existing workspace.
 * Inserts categories, skills, levels, tracks, weeks, modules, lessons,
 * lesson_skill_map, exercises, badges from devops.json seed payload.
 *
 * Idempotent: skips rows that already exist (by slug/code).
 *
 * Usage: tsx drizzle/scripts/bootstrap-full-workspace.ts <workspace-id> <user-id>
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' });

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq, and, sql as dsql } from 'drizzle-orm';
import {
  workspaces,
  skillCategories,
  skills,
  competencyLevels,
  levelTracks,
  weeks,
  modules,
  lessons,
  lessonSkillMap,
  exercises,
  badges,
  userLevelProgress,
  hearts,
  streaks,
  activityLog,
} from '../../src/lib/db/schema';

const workspaceId = process.argv[2];
const userId = process.argv[3];
if (!workspaceId || !userId) {
  console.error('Usage: bootstrap-full-workspace <workspace-id> <user-id>');
  process.exit(1);
}

const dbUrl = process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL!;
const sql = postgres(dbUrl, { prepare: false, max: 1 });
const db = drizzle(sql);

async function main() {
  console.log(`[bootstrap] target workspace=${workspaceId} user=${userId}`);
  const ws = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1);
  if (!ws[0]) throw new Error('Workspace not found');

  const payload = JSON.parse(
    readFileSync(resolve(__dirname, '../seeds/devops.json'), 'utf-8'),
  );

  let counts = { categories: 0, skills: 0, levels: 0, tracks: 0, weeks: 0, modules: 0, lessons: 0, exercises: 0, badges: 0 };
  const catIdBySlug = new Map<string, string>();
  const skillIdBySlug = new Map<string, string>();

  /* Levels */
  for (const [i, l] of payload.levels.entries()) {
    const existing = await db
      .select({ id: competencyLevels.id })
      .from(competencyLevels)
      .where(and(eq(competencyLevels.workspaceId, workspaceId), eq(competencyLevels.code, l.code)))
      .limit(1);
    if (existing[0]) continue;
    await db.insert(competencyLevels).values({
      workspaceId,
      code: l.code,
      label: l.label,
      numericValue: l.numeric,
      description: l.description,
      examples: l.examples,
      color: l.color,
      displayOrder: i,
    });
    counts.levels++;
  }

  /* Categories + Skills */
  for (const [ci, cat] of payload.categories.entries()) {
    let catRow = await db
      .select({ id: skillCategories.id })
      .from(skillCategories)
      .where(and(eq(skillCategories.workspaceId, workspaceId), eq(skillCategories.slug, cat.slug)))
      .limit(1);
    let catId: string;
    if (catRow[0]) catId = catRow[0].id;
    else {
      const inserted = await db
        .insert(skillCategories)
        .values({ workspaceId, slug: cat.slug, name: cat.name, description: cat.description, color: cat.color, icon: cat.icon, displayOrder: ci })
        .returning({ id: skillCategories.id });
      catId = inserted[0]!.id;
      counts.categories++;
    }
    catIdBySlug.set(cat.slug, catId);

    for (const [si, s] of cat.skills.entries()) {
      const existing = await db
        .select({ id: skills.id })
        .from(skills)
        .where(and(eq(skills.workspaceId, workspaceId), eq(skills.slug, s.slug)))
        .limit(1);
      let skillId: string;
      if (existing[0]) skillId = existing[0].id;
      else {
        const inserted = await db
          .insert(skills)
          .values({ workspaceId, categoryId: catId, slug: s.slug, name: s.name, description: s.description, tags: s.tags ?? [], displayOrder: si })
          .returning({ id: skills.id });
        skillId = inserted[0]!.id;
        counts.skills++;
      }
      skillIdBySlug.set(s.slug, skillId);
    }
  }

  /* Tracks + Weeks + Modules + Lessons + Exercises */
  for (const [ti, track] of payload.tracks.entries()) {
    let trackRow = await db
      .select({ id: levelTracks.id })
      .from(levelTracks)
      .where(and(eq(levelTracks.workspaceId, workspaceId), eq(levelTracks.levelCode, track.levelCode)))
      .limit(1);
    let trackId: string;
    if (trackRow[0]) trackId = trackRow[0].id;
    else {
      const inserted = await db
        .insert(levelTracks)
        .values({ workspaceId, levelCode: track.levelCode, title: track.title, description: track.description, displayOrder: ti })
        .returning({ id: levelTracks.id });
      trackId = inserted[0]!.id;
      counts.tracks++;
    }

    for (const week of track.weeks) {
      let wkRow = await db
        .select({ id: weeks.id })
        .from(weeks)
        .where(and(
          eq(weeks.workspaceId, workspaceId),
          eq(weeks.trackId, trackId),
          eq(weeks.weekIndex, week.index),
        ))
        .limit(1);
      let weekId: string;
      if (wkRow[0]) weekId = wkRow[0].id;
      else {
        const inserted = await db
          .insert(weeks)
          .values({
            workspaceId, trackId, weekIndex: week.index,
            title: week.title, summary: week.summary,
            goals: week.goals ?? [], keywords: week.keywords ?? [],
            estHours: week.estHours ?? 8, displayOrder: week.index,
          })
          .returning({ id: weeks.id });
        weekId = inserted[0]!.id;
        counts.weeks++;
      }

      for (const [mi, mod] of (week.modules ?? []).entries()) {
        const insertedMod = await db
          .insert(modules)
          .values({ workspaceId, weekId, title: mod.title, summary: mod.summary, displayOrder: mi })
          .returning({ id: modules.id });
        const modId = insertedMod[0]!.id;
        counts.modules++;

        for (const [li, lesson] of (mod.lessons ?? []).entries()) {
          const existingLesson = await db
            .select({ id: lessons.id })
            .from(lessons)
            .where(and(eq(lessons.workspaceId, workspaceId), eq(lessons.slug, lesson.slug)))
            .limit(1);
          if (existingLesson[0]) continue;
          const insertedLesson = await db
            .insert(lessons)
            .values({
              workspaceId, moduleId: modId, slug: lesson.slug, title: lesson.title,
              introMd: lesson.introMd, estMinutes: lesson.estMinutes ?? 8, displayOrder: li,
            })
            .returning({ id: lessons.id });
          const lessonId = insertedLesson[0]!.id;
          counts.lessons++;

          /* lesson_skill_map */
          for (const sa of (lesson.skillsAdvanced ?? [])) {
            const skillId = skillIdBySlug.get(sa.skillSlug);
            if (!skillId) continue;
            await db.insert(lessonSkillMap).values({
              lessonId, skillId,
              contributesToLevel: sa.contributesToLevel,
              weight: sa.weight ?? 1,
            }).onConflictDoNothing();
          }

          /* exercises */
          for (const [ei, ex] of (lesson.exercises ?? []).entries()) {
            await db.insert(exercises).values({
              workspaceId, lessonId,
              kind: ex.kind,
              promptMd: ex.promptMd,
              payload: ex.payload,
              explanationMd: ex.explanationMd,
              xpAward: ex.xpAward ?? 10,
              displayOrder: ei,
            });
            counts.exercises++;
          }
        }
      }
    }
  }

  /* Badges */
  for (const b of (payload.badges ?? [])) {
    await db.insert(badges).values({
      workspaceId, slug: b.slug, name: b.name, description: b.description,
      icon: b.icon, rule: b.rule,
    }).onConflictDoNothing();
    counts.badges++;
  }

  /* Init user_level_progress */
  for (const [i, l] of payload.levels.entries()) {
    await db.insert(userLevelProgress).values({
      workspaceId, userId, levelCode: l.code,
      status: i === 0 ? 'unlocked' : 'locked',
      unlockedAt: i === 0 ? new Date() : null,
    }).onConflictDoNothing();
  }

  /* Hearts + streak */
  await db.insert(hearts).values({ workspaceId, userId, current: 5, max: 5 }).onConflictDoNothing();
  await db.insert(streaks).values({ workspaceId, userId, currentStreak: 0, longestStreak: 0 }).onConflictDoNothing();

  await db.insert(activityLog).values({
    workspaceId, userId,
    kind: 'workspace_bootstrapped',
    payload: counts,
  });

  console.log('[bootstrap] Done:', counts);
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
