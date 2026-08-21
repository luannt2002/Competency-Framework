/**
 * /w/[slug]/n/[nodeSlug]/practice — the lesson runner screen.
 *
 * Deliberately a child of the node route rather than a new top-level section:
 * the learner already navigates the tree, and practice is something you do
 * *inside* a node, not a separate destination in the sidebar. Breadcrumb and
 * "back" both point at the node, so the trip is: tree -> node -> làm bài.
 *
 * Server Component. It resolves the workspace, finds the lesson the node runs,
 * calls the existing `loadLessonRun` contract, and seeds the client with the
 * learner's own attempt history so a returning visit shows real state instead
 * of a blank form.
 *
 * Access is LEARNER+ (the runner writes progress rows). `resolveWorkspace`
 * fails closed and does not distinguish "no such workspace" from "not allowed",
 * so we redirect rather than render a 403 that would confirm the slug exists.
 */
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { and, eq } from 'drizzle-orm';
import { BookOpen, Clock, PencilLine } from 'lucide-react';
import { RBAC_LEVELS } from '@/lib/rbac/levels';
import { resolveWorkspace } from '@/lib/rbac/resolve';
import { db } from '@/lib/db/client';
import { heartsToNumber } from '@/lib/gamification/hearts';
import { hearts } from '@/lib/db/schema';
import { getNodeBySlug } from '@/lib/tree/queries';
import { findNodeLesson } from '@/lib/learn/node-lesson';
import { loadExerciseOutcomes, loadSettledExplanations } from '@/lib/exercises/attempts';
import { loadLessonRun } from '@/actions/learn';
import { NodeBreadcrumb } from '@/components/learn/node-header';
import { LessonRunner } from '@/components/learn/lesson-runner';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';

export default async function PracticePage({
  params,
}: {
  params: Promise<{ slug: string; nodeSlug: string }>;
}) {
  const { slug, nodeSlug } = await params;

  let resolved;
  try {
    resolved = await resolveWorkspace(slug, RBAC_LEVELS.LEARNER);
  } catch {
    redirect(`/w/${slug}`);
  }
  const { ws, user } = resolved;

  const found = await getNodeBySlug(ws.id, user.id, nodeSlug);
  if (!found) notFound();
  const { node, ancestors } = found;
  const nodeHref = `/w/${slug}/n/${nodeSlug}`;

  const lesson = await findNodeLesson({ workspaceId: ws.id, nodeMeta: node.meta });

  const breadcrumb = (
    <NodeBreadcrumb
      ancestors={[...ancestors, { id: node.id, slug: node.slug, title: node.title }]}
      current={{ title: 'Làm bài' }}
      rootHref={`/w/${slug}`}
      rootLabel="Cây học tập"
      nodeBase={`/w/${slug}/n`}
    />
  );

  if (!lesson || lesson.exerciseCount === 0) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 p-6 md:p-8">
        {breadcrumb}
        <EmptyState
          icon={PencilLine}
          title="Chưa có bài tập cho node này"
          description={
            lesson
              ? `Bài học "${lesson.title}" đã được gắn nhưng chưa có câu hỏi nào.`
              : 'Node này chưa liên kết tới bài học nào có câu hỏi.'
          }
          action={
            <Button asChild variant="outline">
              <Link href={nodeHref}>Quay lại node</Link>
            </Button>
          }
        />
      </div>
    );
  }

  // ĐỌC THUẦN. Việc đánh dấu "đã bắt đầu" do runner gọi ở client (startLesson),
  // vì render của Server Component có thể chạy lại bất cứ lúc nào.
  const run = await loadLessonRun({ workspaceSlug: slug, lessonId: lesson.lessonId });

  const exerciseIds = run.exercises.map((e) => e.id);
  const outcomes = await loadExerciseOutcomes({
    workspaceId: ws.id,
    userId: user.id,
    exerciseIds,
  });
  const [explanations, heartRows] = await Promise.all([
    loadSettledExplanations({ workspaceId: ws.id, lessonId: lesson.lessonId, outcomes }),
    db
      .select({ current: hearts.current })
      .from(hearts)
      .where(and(eq(hearts.workspaceId, ws.id), eq(hearts.userId, user.id)))
      .limit(1),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6 md:p-8">
      {breadcrumb}

      <header className="space-y-2">
        <p className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
          <BookOpen className="size-3.5" aria-hidden />
          Bài tập
        </p>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{run.title}</h1>
        <p className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span>{node.title}</span>
          <span className="inline-flex items-center gap-1 tabular-nums">
            <Clock className="size-3" aria-hidden />~{run.estMinutes} phút
          </span>
          <span className="tabular-nums">{run.exercises.length} câu</span>
        </p>
      </header>

      <LessonRunner
        workspaceSlug={slug}
        lesson={run}
        initialOutcomes={Object.fromEntries(outcomes)}
        initialExplanations={Object.fromEntries(explanations)}
        initialHearts={heartsToNumber(heartRows[0]?.current)}
        backHref={nodeHref}
      />
    </div>
  );
}
