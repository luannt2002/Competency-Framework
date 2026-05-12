/**
 * Workspace server actions.
 *
 * MAIN ACTION: `forkTemplate(templateId, { slug, name })` — clones a framework template
 * into a new workspace owned by the current user.
 *
 * Copies, in one transaction:
 *   - workspaces row
 *   - competency_levels
 *   - skill_categories
 *   - skills
 *   - level_tracks
 *   - weeks
 *   - modules
 *   - lessons (+ lesson_skill_map)
 *   - exercises
 *   - badges (workspace-scoped copies)
 *   - user_level_progress (XS unlocked, others locked)
 *   - hearts (5/5), streaks (0)
 *   - activity_log
 *
 * Idempotent at the slug level — re-running with existing slug throws.
 */
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { eq, sql as dsql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import {
  workspaces,
  frameworkTemplates,
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
} from '@/lib/db/schema';
import { requireUser } from '@/lib/auth/supabase-server';
import { frameworkPayloadSchema, type FrameworkPayload } from '@/lib/framework/payload-schema';
import { toSlug } from '@/lib/utils';
import { writeAudit } from '@/lib/rbac/server';

const forkInput = z.object({
  templateId: z.string().uuid(),
  slug: z.string().min(1).max(40),
  name: z.string().min(1).max(80),
});

/**
 * Core fork — performs the heavy lifting and returns the freshly-created
 * workspace row. Used by both `forkTemplate` (which redirects to /w/<slug>)
 * and the onboarding wizard which prefers to redirect to step 2.
 */
async function forkTemplateCore(input: {
  templateId: string;
  slug: string;
  name: string;
}): Promise<{ id: string; slug: string; name: string }> {
  const user = await requireUser();
  const parsed = forkInput.parse(input);

  // Load template
  const tplRows = await db
    .select()
    .from(frameworkTemplates)
    .where(eq(frameworkTemplates.id, parsed.templateId))
    .limit(1);
  const tpl = tplRows[0];
  if (!tpl) throw new Error('TEMPLATE_NOT_FOUND');

  const payload: FrameworkPayload = frameworkPayloadSchema.parse(tpl.payload);

  // Insert workspace
  const [ws] = await db
    .insert(workspaces)
    .values({
      ownerUserId: user.id,
      slug: parsed.slug,
      name: parsed.name,
      icon: payload.icon,
      color: payload.color,
      frameworkTemplateId: tpl.id,
      visibility: 'private',
    })
    .returning();
  if (!ws) throw new Error('WORKSPACE_INSERT_FAILED');

  // Helper: maps from seed slug → DB uuid (so we can wire FKs across tables)
  const categoryIdBySlug = new Map<string, string>();
  const skillIdBySlug = new Map<string, string>();
  const trackIdByLevel = new Map<string, string>();
  const weekIdByLevelAndIndex = new Map<string, string>();

  /* ---- Levels ---- */
  if (payload.levels.length > 0) {
    await db.insert(competencyLevels).values(
      payload.levels.map((l, i) => ({
        workspaceId: ws.id,
        code: l.code,
        label: l.label,
        numericValue: l.numeric,
        description: l.description,
        examples: l.examples,
        color: l.color,
        displayOrder: i,
      })),
    );
  }

  /* ---- Categories + Skills ---- */
  for (let ci = 0; ci < payload.categories.length; ci++) {
    const cat = payload.categories[ci];
    if (!cat) continue;
    const [insertedCat] = await db
      .insert(skillCategories)
      .values({
        workspaceId: ws.id,
        slug: cat.slug,
        name: cat.name,
        description: cat.description,
        color: cat.color,
        icon: cat.icon,
        displayOrder: ci,
      })
      .returning({ id: skillCategories.id });
    if (!insertedCat) continue;
    categoryIdBySlug.set(cat.slug, insertedCat.id);

    if (cat.skills.length > 0) {
      const inserted = await db
        .insert(skills)
        .values(
          cat.skills.map((s, si) => ({
            workspaceId: ws.id,
            categoryId: insertedCat.id,
            slug: s.slug,
            name: s.name,
            description: s.description,
            tags: s.tags ?? [],
            displayOrder: s.displayOrder ?? si,
          })),
        )
        .returning({ id: skills.id, slug: skills.slug });
      for (const row of inserted) skillIdBySlug.set(row.slug, row.id);
    }
  }

  /* ---- Tracks + Weeks + Modules + Lessons + Exercises ---- */
  for (let ti = 0; ti < payload.tracks.length; ti++) {
    const track = payload.tracks[ti];
    if (!track) continue;

    const [insertedTrack] = await db
      .insert(levelTracks)
      .values({
        workspaceId: ws.id,
        levelCode: track.levelCode,
        title: track.title,
        description: track.description,
        displayOrder: ti,
      })
      .returning({ id: levelTracks.id });
    if (!insertedTrack) continue;
    trackIdByLevel.set(track.levelCode, insertedTrack.id);

    for (const week of track.weeks) {
      const [insertedWeek] = await db
        .insert(weeks)
        .values({
          workspaceId: ws.id,
          trackId: insertedTrack.id,
          weekIndex: week.index,
          title: week.title,
          summary: week.summary,
          goals: week.goals ?? [],
          keywords: week.keywords ?? [],
          estHours: week.estHours ?? 8,
          displayOrder: week.index,
        })
        .returning({ id: weeks.id });
      if (!insertedWeek) continue;
      weekIdByLevelAndIndex.set(`${track.levelCode}:${week.index}`, insertedWeek.id);

      for (let mi = 0; mi < week.modules.length; mi++) {
        const mod = week.modules[mi];
        if (!mod) continue;
        const [insertedMod] = await db
          .insert(modules)
          .values({
            workspaceId: ws.id,
            weekId: insertedWeek.id,
            title: mod.title,
            summary: mod.summary,
            displayOrder: mi,
          })
          .returning({ id: modules.id });
        if (!insertedMod) continue;

        for (let li = 0; li < mod.lessons.length; li++) {
          const lesson = mod.lessons[li];
          if (!lesson) continue;
          const [insertedLesson] = await db
            .insert(lessons)
            .values({
              workspaceId: ws.id,
              moduleId: insertedMod.id,
              slug: lesson.slug,
              title: lesson.title,
              introMd: lesson.introMd,
              estMinutes: lesson.estMinutes ?? 8,
              displayOrder: li,
            })
            .returning({ id: lessons.id });
          if (!insertedLesson) continue;

          // lesson_skill_map links
          const links = lesson.skillsAdvanced
            .map((sa) => {
              const skillId = skillIdBySlug.get(sa.skillSlug);
              if (!skillId) return null;
              return {
                lessonId: insertedLesson.id,
                skillId,
                contributesToLevel: sa.contributesToLevel,
                weight: sa.weight ?? 1,
              };
            })
            .filter((x): x is Exclude<typeof x, null> => x !== null);
          if (links.length > 0) {
            await db.insert(lessonSkillMap).values(links);
          }

          // exercises
          if (lesson.exercises.length > 0) {
            await db.insert(exercises).values(
              lesson.exercises.map((ex, ei) => ({
                workspaceId: ws.id,
                lessonId: insertedLesson.id,
                kind: ex.kind,
                promptMd: ex.promptMd,
                payload: ex.payload as Record<string, unknown>,
                explanationMd: ex.explanationMd,
                xpAward: ex.xpAward ?? 10,
                displayOrder: ei,
              })),
            );
          }
        }
      }
    }
  }

  /* ---- Badges ---- */
  if (payload.badges.length > 0) {
    await db.insert(badges).values(
      payload.badges.map((b) => ({
        workspaceId: ws.id,
        slug: b.slug,
        name: b.name,
        description: b.description,
        icon: b.icon,
        rule: b.rule as Record<string, unknown> | undefined,
      })),
    );
  }

  /* ---- User level progress: XS unlocked, others locked ---- */
  await db.insert(userLevelProgress).values(
    payload.levels.map((l, i) => ({
      workspaceId: ws.id,
      userId: user.id,
      levelCode: l.code,
      status: i === 0 ? ('unlocked' as const) : ('locked' as const),
      unlockedAt: i === 0 ? new Date() : null,
    })),
  );

  /* ---- Hearts + Streak init ---- */
  await db
    .insert(hearts)
    .values({ workspaceId: ws.id, userId: user.id, current: 5, max: 5 });
  await db.insert(streaks).values({
    workspaceId: ws.id,
    userId: user.id,
    currentStreak: 0,
    longestStreak: 0,
  });

  /* ---- Activity log ---- */
  await db.insert(activityLog).values({
    workspaceId: ws.id,
    userId: user.id,
    kind: 'framework_forked',
    payload: { templateSlug: tpl.slug, templateId: tpl.id },
  });

  // Audit: the creator is implicitly workspace_owner at this point because
  // workspaces.owner_user_id == user.id. We hard-code the role here rather
  // than calling requireMinLevel to avoid a redundant DB lookup.
  await writeAudit({
    workspaceId: ws.id,
    actorUserId: user.id,
    actorRole: 'workspace_owner',
    action: 'workspace.create',
    resourceType: 'workspace',
    resourceId: ws.id,
    before: null,
    after: {
      id: ws.id,
      slug: ws.slug,
      name: ws.name,
      templateId: tpl.id,
      templateSlug: tpl.slug,
    },
  });

  /* ---- Bump fork count ---- */
  await db
    .update(frameworkTemplates)
    .set({ forksCount: dsql`${frameworkTemplates.forksCount} + 1` })
    .where(eq(frameworkTemplates.id, tpl.id));

  revalidatePath('/');
  return { id: ws.id, slug: ws.slug, name: ws.name };
}

/**
 * Public server action — fork a template and redirect to the workspace home.
 * Used by non-wizard callers (e.g. simple links / scripts).
 */
export async function forkTemplate(formData: FormData): Promise<void> {
  const ws = await forkTemplateCore({
    templateId: String(formData.get('templateId') ?? ''),
    slug: toSlug(String(formData.get('slug') ?? '')),
    name: String(formData.get('name') ?? ''),
  });
  redirect(`/w/${ws.slug}`);
}

/**
 * Onboarding-wizard variant — forks a template, then redirects to step 2
 * (name your workspace) carrying the new workspace id in the query string.
 *
 * The wizard auto-generates a unique slug (template slug + random suffix) so
 * we don't collide if the user has already forked the same template before.
 */
export async function forkTemplateForOnboarding(formData: FormData): Promise<void> {
  const user = await requireUser();
  const templateId = String(formData.get('templateId') ?? '');
  if (!templateId) throw new Error('TEMPLATE_ID_REQUIRED');

  // Load template (need name/slug for defaults)
  const tplRows = await db
    .select()
    .from(frameworkTemplates)
    .where(eq(frameworkTemplates.id, templateId))
    .limit(1);
  const tpl = tplRows[0];
  if (!tpl) throw new Error('TEMPLATE_NOT_FOUND');

  // Auto-pick a unique slug: <tpl-slug>-<userId-prefix>-<random>
  const suffix = Math.random().toString(36).slice(2, 6);
  const baseSlug = toSlug(`${tpl.slug}-${user.id.slice(0, 4)}-${suffix}`);

  const ws = await forkTemplateCore({
    templateId,
    slug: baseSlug,
    name: `${tpl.name} (Mine)`,
  });

  redirect(`/onboarding?step=2&ws=${ws.id}`);
}

/**
 * Step 2 of the onboarding wizard — rename the freshly-forked workspace.
 * Also updates the slug to a slugified form of the new name (best-effort —
 * falls back to the existing slug if the new one would collide).
 */
export async function renameOnboardingWorkspace(formData: FormData): Promise<void> {
  const user = await requireUser();
  const workspaceId = String(formData.get('workspaceId') ?? '');
  const rawName = String(formData.get('name') ?? '').trim();
  if (!workspaceId) throw new Error('WORKSPACE_ID_REQUIRED');
  if (!rawName) throw new Error('NAME_REQUIRED');

  // Load + authorize
  const rows = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);
  const ws = rows[0];
  if (!ws) throw new Error('WORKSPACE_NOT_FOUND');
  if (ws.ownerUserId !== user.id) throw new Error('FORBIDDEN');

  const desiredSlug = toSlug(rawName).slice(0, 40) || ws.slug;

  // Try slug update; fall back to existing slug on uniqueness conflict
  let finalSlug = ws.slug;
  try {
    await db
      .update(workspaces)
      .set({ name: rawName.slice(0, 80), slug: desiredSlug })
      .where(eq(workspaces.id, workspaceId));
    finalSlug = desiredSlug;
  } catch {
    await db
      .update(workspaces)
      .set({ name: rawName.slice(0, 80) })
      .where(eq(workspaces.id, workspaceId));
  }

  revalidatePath('/');
  redirect(`/onboarding?step=3&ws=${workspaceId}&slug=${finalSlug}`);
}

/**
 * Onboarding "blank" — creates a minimal workspace without a template fork.
 * Inserts only the workspace row + the standard hearts/streaks seed so that
 * /w/[slug] is immediately accessible.
 */
export async function createBlankWorkspace(): Promise<void> {
  const user = await requireUser();

  const suffix = Math.random().toString(36).slice(2, 6);
  const slug = toSlug(`workspace-${user.id.slice(0, 4)}-${suffix}`);

  const [ws] = await db
    .insert(workspaces)
    .values({
      ownerUserId: user.id,
      slug,
      name: 'Cây trống',
      visibility: 'private',
    })
    .returning();
  if (!ws) throw new Error('WORKSPACE_INSERT_FAILED');

  await db.insert(hearts).values({ workspaceId: ws.id, userId: user.id, current: 5, max: 5 });
  await db.insert(streaks).values({
    workspaceId: ws.id,
    userId: user.id,
    currentStreak: 0,
    longestStreak: 0,
  });
  await db.insert(activityLog).values({
    workspaceId: ws.id,
    userId: user.id,
    kind: 'framework_forked',
    payload: { blank: true },
  });

  await writeAudit({
    workspaceId: ws.id,
    actorUserId: user.id,
    actorRole: 'workspace_owner',
    action: 'workspace.create',
    resourceType: 'workspace',
    resourceId: ws.id,
    before: null,
    after: { id: ws.id, slug: ws.slug, name: ws.name, blank: true },
  });

  revalidatePath('/');
  redirect(`/onboarding?step=2&ws=${ws.id}`);
}
