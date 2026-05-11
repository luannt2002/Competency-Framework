/**
 * Lesson Runner page — loads lesson data server-side, hands off to client runner.
 */
import { notFound } from 'next/navigation';
import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { lessons } from '@/lib/db/schema';
import { requireWorkspaceAccess } from '@/lib/workspace';
import { requireUser } from '@/lib/auth/supabase-server';
import { startLesson } from '@/actions/learn';
import { LessonRunner } from '@/components/learn/exercise-runner/runner';

export default async function LessonPage({
  params,
}: {
  params: Promise<{
    slug: string;
    levelCode: string;
    weekIndex: string;
    lessonSlug: string;
  }>;
}) {
  const { slug, levelCode, weekIndex, lessonSlug } = await params;
  const ws = await requireWorkspaceAccess(slug);
  await requireUser();

  // Find lesson id by slug within workspace
  const lessonRows = await db
    .select({ id: lessons.id })
    .from(lessons)
    .where(and(eq(lessons.slug, lessonSlug), eq(lessons.workspaceId, ws.id)))
    .limit(1);
  const lesson = lessonRows[0];
  if (!lesson) notFound();

  // Pre-load run data via server action (also bumps user_lesson_progress)
  const data = await startLesson({
    workspaceSlug: ws.slug,
    lessonId: lesson.id,
  });

  const backHref = `/w/${slug}/learn/${levelCode}/${weekIndex}`;

  return <LessonRunner workspaceSlug={ws.slug} data={data} backHref={backHref} />;
}
