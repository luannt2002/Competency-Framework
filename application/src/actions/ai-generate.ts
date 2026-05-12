/**
 * AI Generate Content — server action stub.
 *
 * Stub returns a hand-crafted exercise demonstrating the shape.
 * Production: wire to Claude API with a prompt template; insert into exercises table.
 *
 * Wire (future):
 *   1. ANTHROPIC_API_KEY env var
 *   2. Replace stub body with Anthropic SDK call (`@anthropic-ai/sdk`)
 *   3. Use prompt caching for the lesson context (cost optimization)
 *   4. Validate JSON response against frameworkPayloadSchema's exerciseSeed
 *   5. INSERT into exercises table linked to lessonId
 */
'use server';

import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db/client';
import { lessons, exercises, workspaces, activityLog } from '@/lib/db/schema';
import { requireUser } from '@/lib/auth/supabase-server';
import type { ExerciseKind } from '@/types';

const input = z.object({
  workspaceSlug: z.string(),
  lessonId: z.string().uuid(),
  count: z.number().int().min(1).max(5).default(2),
});

export type GeneratedExercise = {
  kind: ExerciseKind;
  promptMd: string;
  payload: unknown;
  explanationMd?: string;
  xpAward: number;
};

const STUB_BANK: GeneratedExercise[] = [
  {
    kind: 'mcq',
    promptMd: '[AI-generated] Which AWS service provides managed Kubernetes control plane?',
    payload: {
      options: [
        { id: 'a', text: 'ECS' },
        { id: 'b', text: 'EKS' },
        { id: 'c', text: 'Fargate alone' },
        { id: 'd', text: 'AppRunner' },
      ],
      correctId: 'b',
      shuffle: true,
    },
    explanationMd:
      'EKS = Elastic Kubernetes Service. ECS is AWS-native container orchestration (not K8s).',
    xpAward: 10,
  },
  {
    kind: 'type_answer',
    promptMd: '[AI-generated] Type the kubectl command to scale a Deployment "api" to 5 replicas:',
    payload: {
      accepts: ['^kubectl\\s+scale\\s+deployment(/api| api)\\s+--replicas=5$'],
      matchKind: 'regex',
      hint: 'kubectl scale deployment ...',
    },
    explanationMd: '`kubectl scale deployment/api --replicas=5` is the canonical form.',
    xpAward: 10,
  },
  {
    kind: 'fill_blank',
    promptMd: '[AI-generated] In Terraform, ___ stores state and ___ provides locking.',
    payload: {
      template: '___ stores state and ___ provides locking.',
      blanks: [
        { id: 1, accepts: ['S3'], matchKind: 'exact_ci' },
        { id: 2, accepts: ['DynamoDB'], matchKind: 'exact_ci' },
      ],
    },
    explanationMd: 'AWS backend: S3 for state, DynamoDB for distributed lock.',
    xpAward: 10,
  },
];

export async function aiGenerateExercises(payloadIn: z.infer<typeof input>): Promise<{
  generated: number;
}> {
  const user = await requireUser();
  const parsed = input.parse(payloadIn);

  const wsRows = await db
    .select({ id: workspaces.id, slug: workspaces.slug })
    .from(workspaces)
    .where(and(eq(workspaces.slug, parsed.workspaceSlug), eq(workspaces.ownerUserId, user.id)))
    .limit(1);
  const ws = wsRows[0];
  if (!ws) throw new Error('WORKSPACE_NOT_FOUND_OR_FORBIDDEN');

  const lessonRows = await db
    .select({ id: lessons.id })
    .from(lessons)
    .where(and(eq(lessons.id, parsed.lessonId), eq(lessons.workspaceId, ws.id)))
    .limit(1);
  if (!lessonRows[0]) throw new Error('LESSON_NOT_FOUND');

  // STUB: pick `count` exercises from the bank.
  // Replace this block with Anthropic SDK call (see PROMPT TEMPLATE below).
  const picked = STUB_BANK.slice(0, parsed.count);

  await db.insert(exercises).values(
    picked.map((ex, i) => ({
      workspaceId: ws.id,
      lessonId: parsed.lessonId,
      kind: ex.kind,
      promptMd: ex.promptMd,
      payload: ex.payload as Record<string, unknown>,
      explanationMd: ex.explanationMd,
      xpAward: ex.xpAward,
      displayOrder: 100 + i,
    })),
  );

  await db.insert(activityLog).values({
    workspaceId: ws.id,
    userId: user.id,
    kind: 'ai_generated_exercises',
    payload: { lessonId: parsed.lessonId, count: picked.length },
  });

  revalidatePath(`/w/${ws.slug}`);
  return { generated: picked.length };
}

/* -----------------------------------------------------------
 * PROMPT TEMPLATE for production wiring (Claude API)
 * -----------------------------------------------------------
 * System: You are a DevOps mentor generating practice exercises for a
 *   lesson titled "{lesson.title}". Return strict JSON matching this schema:
 *   { exercises: Array<{ kind, promptMd, payload, explanationMd, xpAward }> }
 *   where `kind` is one of: mcq | mcq_multi | fill_blank | order_steps |
 *   type_answer | code_block_review.
 *
 * User: Lesson intro: {lesson.introMd}
 *       Skills advanced: {skillsAdvanced.map(s => s.skillSlug).join(', ')}
 *       Generate {count} exercises mixing 2-3 different `kind`s.
 *       Keep prompts in Vietnamese, but keep technical terms (kubectl,
 *       Terraform, IAM, ...) in English. Vary difficulty.
 *
 * Prompt-cache the system + lesson context (ephemeral up to 1h) — only the
 * user message about `count` differs across calls = 95%+ cache hit.
 *
 * Validate the returned JSON with frameworkPayloadSchema's exerciseSeed
 * before INSERT. On parse failure, retry once with model.
 * ----------------------------------------------------------- */
