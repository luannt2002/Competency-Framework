/**
 * Zod schema for `framework_templates.payload` (v2.0).
 * Validates seed JSON before forking into a workspace.
 */
import { z } from 'zod';

export const levelSeed = z.object({
  code: z.string(),
  label: z.string(),
  numeric: z.number().int().min(0).max(100),
  description: z.string().optional(),
  examples: z.string().optional(),
  color: z.string().optional(),
});

export const skillSeed = z.object({
  slug: z.string(),
  name: z.string(),
  description: z.string().optional(),
  tags: z.array(z.string()).default([]),
  displayOrder: z.number().int().optional(),
});

export const categorySeed = z.object({
  slug: z.string(),
  name: z.string(),
  description: z.string().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
  skills: z.array(skillSeed),
});

export const exerciseSeed = z.object({
  kind: z.enum([
    'mcq',
    'mcq_multi',
    'fill_blank',
    'order_steps',
    'type_answer',
    'code_block_review',
  ]),
  promptMd: z.string(),
  payload: z.unknown(),
  explanationMd: z.string().optional(),
  xpAward: z.number().int().default(10),
});

export const lessonSeed = z.object({
  slug: z.string(),
  title: z.string(),
  introMd: z.string().optional(),
  estMinutes: z.number().int().default(8),
  skillsAdvanced: z
    .array(
      z.object({
        skillSlug: z.string(),
        contributesToLevel: z.string(),
        weight: z.number().int().default(1),
      }),
    )
    .default([]),
  exercises: z.array(exerciseSeed).default([]),
});

export const moduleSeed = z.object({
  title: z.string(),
  summary: z.string().optional(),
  lessons: z.array(lessonSeed).default([]),
});

export const weekSeed = z.object({
  index: z.number().int(),
  title: z.string(),
  summary: z.string().optional(),
  goals: z.array(z.string()).default([]),
  keywords: z.array(z.string()).default([]),
  estHours: z.number().int().default(8),
  modules: z.array(moduleSeed).default([]),
});

export const trackSeed = z.object({
  levelCode: z.string(),
  title: z.string(),
  description: z.string().optional(),
  weeks: z.array(weekSeed).default([]),
});

export const badgeSeed = z.object({
  slug: z.string(),
  name: z.string(),
  description: z.string().optional(),
  icon: z.string().optional(),
  rule: z.unknown().optional(),
});

export const frameworkPayloadSchema = z.object({
  schemaVersion: z.string().default('2.0'),
  slug: z.string(),
  name: z.string(),
  domain: z.string().optional(),
  description: z.string().optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
  levels: z.array(levelSeed),
  categories: z.array(categorySeed),
  tracks: z.array(trackSeed).default([]),
  badges: z.array(badgeSeed).default([]),
});

export type FrameworkPayload = z.infer<typeof frameworkPayloadSchema>;
