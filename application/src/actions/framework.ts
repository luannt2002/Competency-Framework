/**
 * Framework editor server actions — categories, skills, levels CRUD.
 * All ownership-checked + workspace-scoped.
 */
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import {
  workspaces,
  skillCategories,
  skills,
  competencyLevels,
  activityLog,
} from '@/lib/db/schema';
import { requireUser } from '@/lib/auth/supabase-server';
import { toSlug } from '@/lib/utils';

async function resolveWorkspace(slug: string, userId: string) {
  const rows = await db
    .select({ id: workspaces.id, slug: workspaces.slug })
    .from(workspaces)
    .where(and(eq(workspaces.slug, slug), eq(workspaces.ownerUserId, userId)))
    .limit(1);
  const ws = rows[0];
  if (!ws) throw new Error('WORKSPACE_NOT_FOUND_OR_FORBIDDEN');
  return ws;
}

/* ============ Categories ============ */
const categoryInput = z.object({
  workspaceSlug: z.string(),
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(60),
  description: z.string().max(500).optional(),
  color: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
  icon: z.string().optional(),
});

export async function upsertCategory(input: z.infer<typeof categoryInput>): Promise<void> {
  const user = await requireUser();
  const parsed = categoryInput.parse(input);
  const ws = await resolveWorkspace(parsed.workspaceSlug, user.id);

  const slug = toSlug(parsed.name);
  if (parsed.id) {
    await db
      .update(skillCategories)
      .set({
        name: parsed.name,
        description: parsed.description,
        color: parsed.color,
        icon: parsed.icon,
      })
      .where(and(eq(skillCategories.id, parsed.id), eq(skillCategories.workspaceId, ws.id)));
  } else {
    await db.insert(skillCategories).values({
      workspaceId: ws.id,
      slug,
      name: parsed.name,
      description: parsed.description,
      color: parsed.color,
      icon: parsed.icon,
    });
  }

  await db.insert(activityLog).values({
    workspaceId: ws.id,
    userId: user.id,
    kind: parsed.id ? 'category_updated' : 'category_created',
    payload: { name: parsed.name },
  });
  revalidatePath(`/w/${ws.slug}/framework`);
}

export async function deleteCategory(workspaceSlug: string, categoryId: string): Promise<void> {
  const user = await requireUser();
  const ws = await resolveWorkspace(workspaceSlug, user.id);
  await db
    .delete(skillCategories)
    .where(and(eq(skillCategories.id, categoryId), eq(skillCategories.workspaceId, ws.id)));
  await db.insert(activityLog).values({
    workspaceId: ws.id,
    userId: user.id,
    kind: 'category_deleted',
    payload: { categoryId },
  });
  revalidatePath(`/w/${ws.slug}/framework`);
  revalidatePath(`/w/${ws.slug}/skills`);
}

/* ============ Skills ============ */
const skillInput = z.object({
  workspaceSlug: z.string(),
  id: z.string().uuid().optional(),
  categoryId: z.string().uuid(),
  name: z.string().min(1).max(120),
  description: z.string().max(1000).optional(),
  tags: z.array(z.string()).max(10).optional(),
});

export async function upsertSkill(input: z.infer<typeof skillInput>): Promise<void> {
  const user = await requireUser();
  const parsed = skillInput.parse(input);
  const ws = await resolveWorkspace(parsed.workspaceSlug, user.id);

  const slug = toSlug(parsed.name);
  if (parsed.id) {
    await db
      .update(skills)
      .set({
        categoryId: parsed.categoryId,
        name: parsed.name,
        description: parsed.description,
        tags: parsed.tags ?? [],
      })
      .where(and(eq(skills.id, parsed.id), eq(skills.workspaceId, ws.id)));
  } else {
    await db.insert(skills).values({
      workspaceId: ws.id,
      categoryId: parsed.categoryId,
      slug,
      name: parsed.name,
      description: parsed.description,
      tags: parsed.tags ?? [],
    });
  }

  await db.insert(activityLog).values({
    workspaceId: ws.id,
    userId: user.id,
    kind: parsed.id ? 'skill_updated' : 'skill_created',
    payload: { name: parsed.name },
  });
  revalidatePath(`/w/${ws.slug}/framework`);
  revalidatePath(`/w/${ws.slug}/skills`);
}

export async function deleteSkill(workspaceSlug: string, skillId: string): Promise<void> {
  const user = await requireUser();
  const ws = await resolveWorkspace(workspaceSlug, user.id);
  await db.delete(skills).where(and(eq(skills.id, skillId), eq(skills.workspaceId, ws.id)));
  await db.insert(activityLog).values({
    workspaceId: ws.id,
    userId: user.id,
    kind: 'skill_deleted',
    payload: { skillId },
  });
  revalidatePath(`/w/${ws.slug}/framework`);
  revalidatePath(`/w/${ws.slug}/skills`);
}

/* ============ Levels ============ */
const levelInput = z.object({
  workspaceSlug: z.string(),
  id: z.string().uuid(),
  label: z.string().min(1).max(80),
  description: z.string().max(1000).optional(),
  examples: z.string().max(1000).optional(),
});

export async function updateLevel(input: z.infer<typeof levelInput>): Promise<void> {
  const user = await requireUser();
  const parsed = levelInput.parse(input);
  const ws = await resolveWorkspace(parsed.workspaceSlug, user.id);

  await db
    .update(competencyLevels)
    .set({
      label: parsed.label,
      description: parsed.description,
      examples: parsed.examples,
    })
    .where(and(eq(competencyLevels.id, parsed.id), eq(competencyLevels.workspaceId, ws.id)));

  await db.insert(activityLog).values({
    workspaceId: ws.id,
    userId: user.id,
    kind: 'level_updated',
    payload: { id: parsed.id },
  });
  revalidatePath(`/w/${ws.slug}/framework`);
}
