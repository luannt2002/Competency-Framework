/**
 * The "Bài tập" block on a node page — the door into the lesson runner.
 *
 * A node page used to end at prose, resources and comments: everything about
 * a lesson EXCEPT doing it. This section is the entry point, placed right
 * under the node body so it sits where the learner already is when they finish
 * reading.
 *
 * Server component (no interactivity of its own) — it renders a link, and the
 * runner takes over from there.
 *
 * Status vocabulary matches node-card.tsx: emerald = done, primary = in
 * progress, muted = waiting on someone else.
 */
import Link from 'next/link';
import { CheckCircle2, Clock3, PencilLine, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { LessonProgress } from '@/lib/exercises/runner';

export function PracticeSection({
  href,
  lessonTitle,
  exerciseCount,
  estMinutes,
  progress,
}: {
  href: string;
  lessonTitle: string;
  exerciseCount: number;
  estMinutes: number;
  progress: LessonProgress;
}) {
  const finished = progress.total > 0 && progress.correct === progress.total;
  const started = progress.answered > 0;
  const pct = progress.total === 0 ? 0 : Math.round((progress.answered / progress.total) * 100);

  return (
    <section
      className={cn(
        'surface p-5',
        finished && 'border-emerald-500/40 bg-emerald-500/5',
        !finished && started && 'border-primary/40 bg-primary/5',
      )}
      aria-labelledby="practice-heading"
    >
      <div className="flex flex-wrap items-start gap-4">
        <div
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-xl',
            finished ? 'bg-emerald-500/10' : 'bg-hue-1/10',
          )}
        >
          {finished ? (
            <CheckCircle2 className="size-5 text-emerald-700 dark:text-emerald-400" aria-hidden />
          ) : (
            <PencilLine className="size-5 text-hue-1" aria-hidden />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h2 id="practice-heading" className="text-sm font-semibold">
            Bài tập · {lessonTitle}
          </h2>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="tabular-nums">{exerciseCount} câu</span>
            <span className="tabular-nums">~{estMinutes} phút</span>
            {started && (
              <span className="tabular-nums">
                {progress.correct}/{progress.total} đúng
              </span>
            )}
            {progress.awaitingReview > 0 && (
              <span className="inline-flex items-center gap-1">
                <Clock3 className="size-3" aria-hidden />
                {progress.awaitingReview} chờ chấm
              </span>
            )}
          </p>

          {started && (
            <div
              className="mt-3 h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-secondary"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Số câu đã nộp"
            >
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  finished ? 'bg-emerald-500' : 'accent-gradient',
                )}
                style={{ width: `${Math.max(2, pct)}%` }}
              />
            </div>
          )}
        </div>

        <Button asChild variant={finished ? 'outline' : 'default'}>
          <Link href={href}>
            <Play className="size-4" aria-hidden />
            {finished ? 'Xem lại bài' : started ? 'Làm tiếp' : 'Bắt đầu làm bài'}
          </Link>
        </Button>
      </div>
    </section>
  );
}
