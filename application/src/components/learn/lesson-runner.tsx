'use client';

/**
 * The lesson runner — the pedal the engine was missing.
 *
 * `startLesson` and `submitExercise` have existed and been unreachable: no
 * component called them, so 72 authored exercises had no screen. This is that
 * screen. It shows one exercise at a time with a step rail, keeps the answer
 * drafts, submits through the existing actions, and finishes with
 * `completeLesson`.
 *
 * State that lives here and nowhere else:
 *   - the in-progress draft per exercise
 *   - the outcome of the latest attempt (seeded from the DB on mount, so a
 *     learner returning after a teacher graded their essay sees the grade)
 *   - hearts, which `submitExercise` returns authoritatively on every submit
 *
 * Rules it does NOT own: which widget, whether a draft is complete, what a
 * verdict means, how a lesson score is computed. Those are in
 * `@/lib/exercises/runner` — pure and unit-tested — because a rule that lives
 * in a component is a rule that cannot be tested and will be re-implemented
 * slightly differently by the next screen.
 */
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Flag,
  Heart,
  Loader2,
  Trophy,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MarkdownRenderer } from '@/components/learn/markdown-renderer';
import { fireConfetti } from '@/components/learn/confetti';
import { ExerciseCard, type ExerciseUiState } from './exercise/exercise-card';
import { cn } from '@/lib/utils';
import {
  buildRunnerSpec,
  draftToAnswer,
  emptyDraft,
  isDraftReady,
  summarizeLesson,
  verdictTone,
  type ExerciseOutcome,
  type RunnerSpec,
} from '@/lib/exercises/runner';
import {
  completeLesson,
  startLesson,
  submitExercise,
  type CompleteResult,
  type LessonRunData,
} from '@/actions/learn';

export type LessonRunnerProps = {
  workspaceSlug: string;
  lesson: LessonRunData;
  /** Attempt history keyed by exercise id — plain object so it serialises. */
  initialOutcomes: Record<string, ExerciseOutcome>;
  /** Explanations already earned (settled attempts only). */
  initialExplanations: Record<string, string>;
  initialHearts: number;
  /** Where the "back" affordance goes — the node this lesson belongs to. */
  backHref: string;
};

export function LessonRunner({
  workspaceSlug,
  lesson,
  initialOutcomes,
  initialExplanations,
  initialHearts,
  backHref,
}: LessonRunnerProps) {
  const router = useRouter();
  const exercises = lesson.exercises;

  // Đánh dấu "đã bắt đầu làm bài" đúng MỘT lần, từ phía client.
  // Trước đây việc này nằm trong render của trang (Server Component), nên
  // `attempts` đếm cả lượt xem trang: đo được 71 → 73 sau đúng hai lần curl,
  // trong khi số lượt làm bài thật chỉ 24. Ref chặn StrictMode gọi hai lần
  // trong dev; lỗi ở đây không được chặn đường học nên chỉ ghi log.
  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void startLesson({ workspaceSlug, lessonId: lesson.lessonId }).catch((e) => {
      console.error('[lesson-runner] startLesson failed', e);
    });
  }, [workspaceSlug, lesson.lessonId]);

  const specs = useMemo<Record<string, RunnerSpec>>(() => {
    const out: Record<string, RunnerSpec> = {};
    for (const ex of exercises) {
      out[ex.id] = buildRunnerSpec({
        engine: ex.engine,
        payload: ex.payload,
        answerSpec: ex.answerSpec,
        // Seeded by exercise id so a shuffled option list is stable across
        // re-renders and reloads.
        seed: ex.id,
      });
    }
    return out;
  }, [exercises]);

  const [states, setStates] = useState<Record<string, ExerciseUiState>>(() => {
    const out: Record<string, ExerciseUiState> = {};
    for (const ex of exercises) {
      const spec = buildRunnerSpec({
        engine: ex.engine,
        payload: ex.payload,
        answerSpec: ex.answerSpec,
        seed: ex.id,
      });
      out[ex.id] = {
        draft: emptyDraft(spec),
        outcome: initialOutcomes[ex.id] ?? null,
        feedback: null,
        explanationMd: initialExplanations[ex.id] ?? null,
        xpAwarded: null,
        submitting: false,
        error: null,
        retrying: false,
      };
    }
    return out;
  });

  const [index, setIndex] = useState(0);
  const [hearts, setHearts] = useState(initialHearts);
  const [completion, setCompletion] = useState<CompleteResult | null>(null);
  const [finishing, startFinishing] = useTransition();

  // When each exercise first appeared, so `timeTakenMs` is real rather than 0.
  const shownAt = useRef<Record<string, number>>({});
  const current = exercises[index];
  if (current && shownAt.current[current.id] === undefined) {
    shownAt.current[current.id] = Date.now();
  }

  const outcomes = useMemo(() => {
    const map = new Map<string, ExerciseOutcome>();
    for (const [id, s] of Object.entries(states)) {
      if (s.outcome) map.set(id, s.outcome);
    }
    return map;
  }, [states]);

  const progress = useMemo(
    () => summarizeLesson(exercises.map((e) => e.id), outcomes),
    [exercises, outcomes],
  );

  const patch = useCallback((id: string, next: Partial<ExerciseUiState>) => {
    setStates((prev) => {
      const cur = prev[id];
      if (!cur) return prev;
      return { ...prev, [id]: { ...cur, ...next } };
    });
  }, []);

  const onSubmit = useCallback(
    async (exerciseId: string) => {
      const spec = specs[exerciseId];
      const state = states[exerciseId];
      if (!spec || !state || state.submitting) return;

      patch(exerciseId, { submitting: true, error: null });
      try {
        const started = shownAt.current[exerciseId] ?? Date.now();
        const result = await submitExercise({
          workspaceSlug,
          lessonId: lesson.lessonId,
          exerciseId,
          answer: draftToAnswer(spec, state.draft),
          timeTakenMs: Math.min(60 * 60 * 1000, Math.max(0, Date.now() - started)),
        });

        const prev = state.outcome;
        const outcome: ExerciseOutcome = {
          exerciseId,
          status: result.status,
          score: result.score,
          attemptCount: (prev?.attemptCount ?? 0) + 1,
          everCorrect: (prev?.everCorrect ?? false) || result.status === 'correct',
          bestScore: Math.max(prev?.bestScore ?? 0, result.score),
          // A fresh submit carries no grader note; an old one must not linger.
          feedbackMd: null,
          gradedAt: null,
          submittedAt: new Date().toISOString(),
          awaitingReview: result.status === 'pending_review',
        };

        patch(exerciseId, {
          submitting: false,
          retrying: false,
          outcome,
          feedback: result.feedback,
          explanationMd: result.explanationMd,
          xpAwarded: result.xpAwarded,
        });
        setHearts(result.heartsLeft);

        if (result.status === 'correct') {
          fireConfetti({ intensity: 'small' });
        } else if (result.status === 'pending_review') {
          toast.success('Đã nộp bài', {
            description: 'Bài vào hàng đợi chấm. Bạn sẽ được thông báo khi có điểm.',
          });
        }
      } catch (err) {
        // F7 — hết tim thì server chặn nộp. Nói bằng tiếng người, kèm việc cần
        // làm tiếp, thay vì ném mã lỗi thô ra màn hình.
        const raw = err instanceof Error ? err.message : String(err);
        if (raw === 'NO_HEARTS') {
          setHearts(0);
          patch(exerciseId, { submitting: false, retrying: false });
          toast.error('Bạn đã hết tim', {
            description:
              'Tim hồi lại 1 trái mỗi 4 giờ. Ôn lại một bài đã hoàn thành cũng được +1 tim.',
          });
          return;
        }
        patch(exerciseId, { submitting: false, error: raw });
      }
    },
    [specs, states, patch, workspaceSlug, lesson.lessonId],
  );

  const onFinish = () => {
    if (finishing) return;
    startFinishing(async () => {
      try {
        // The server recomputes this from recorded attempts; sending it keeps
        // the action's signature honest without making the client the source
        // of truth for anyone's score.
        const res = await completeLesson({
          workspaceSlug,
          lessonId: lesson.lessonId,
          scorePct: progress.scorePct,
        });
        setCompletion(res);
        fireConfetti({ intensity: 'big' });
        toast.success('Hoàn thành bài học', {
          description:
            `+${res.xpAwarded} XP · streak ${res.newStreak}` +
            // F11 — ôn lại bài đã xong được +1 tim; nói ra thì người học mới
            // biết đường kiếm lại tim tồn tại.
            (res.heartsEarned > 0 ? ` · +${res.heartsEarned} tim (ôn lại)` : ''),
        });
        if (res.heartsEarned > 0) setHearts((h) => Math.min(5, h + res.heartsEarned));
        router.refresh();
      } catch (err) {
        toast.error('Không hoàn thành được bài học', { description: String(err) });
      }
    });
  };

  if (exercises.length === 0 || !current) {
    return (
      <div className="surface p-8 text-center text-sm text-muted-foreground">
        Bài học này chưa có câu hỏi nào.
      </div>
    );
  }

  const currentState = states[current.id];
  const currentSpec = specs[current.id];
  const pct = progress.total === 0 ? 0 : Math.round((progress.answered / progress.total) * 100);

  return (
    <div className="space-y-6">
      {/* Progress + hearts */}
      <section className="surface space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="font-medium">
            {progress.answered}/{progress.total} câu đã nộp
          </span>
          <span className="text-xs tabular-nums text-muted-foreground">
            {progress.correct} đúng
          </span>
          {progress.awaitingReview > 0 && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Clock3 className="size-3" aria-hidden />
              {progress.awaitingReview} chờ chấm
            </span>
          )}
          <span className="ml-auto inline-flex items-center gap-1 text-xs tabular-nums text-muted-foreground">
            <Heart className="size-3.5 text-destructive" aria-hidden />
            {hearts}
          </span>
        </div>
        <div
          className="h-2 w-full overflow-hidden rounded-full bg-secondary"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Tiến độ bài học"
        >
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              pct === 100 ? 'bg-emerald-500' : 'accent-gradient',
            )}
            style={{ width: `${Math.max(2, pct)}%` }}
          />
        </div>

        {/* Step rail — jump to any exercise, with its state legible at a glance. */}
        <nav aria-label="Danh sách câu hỏi" className="flex flex-wrap gap-1.5">
          {exercises.map((ex, i) => {
            const tone = verdictTone(states[ex.id]?.outcome?.status ?? null);
            return (
              <button
                key={ex.id}
                type="button"
                onClick={() => setIndex(i)}
                aria-current={i === index ? 'step' : undefined}
                aria-label={`Câu ${i + 1}`}
                className={cn(
                  'size-7 rounded-lg border text-xs font-semibold tabular-nums transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  tone === 'correct' && 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
                  tone === 'partial' && 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400',
                  tone === 'incorrect' && 'border-destructive/40 bg-destructive/10 text-destructive',
                  tone === 'pending' && 'border-border bg-secondary text-muted-foreground',
                  tone === null && 'border-border bg-card text-muted-foreground',
                  i === index && 'ring-2 ring-ring',
                )}
              >
                {i + 1}
              </button>
            );
          })}
        </nav>
      </section>

      {lesson.introMd && index === 0 && (
        <section className="surface p-4 text-sm md:p-5">
          <MarkdownRenderer>{lesson.introMd}</MarkdownRenderer>
        </section>
      )}

      {currentState && currentSpec && (
        <ExerciseCard
          exercise={current}
          spec={currentSpec}
          state={currentState}
          index={index}
          total={exercises.length}
          ready={isDraftReady(currentSpec, currentState.draft)}
          onChange={(draft) => patch(current.id, { draft })}
          onSubmit={() => void onSubmit(current.id)}
          onRetry={() => patch(current.id, { retrying: true, feedback: null, xpAwarded: null })}
        />
      )}

      {/* Navigation */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          disabled={index === 0}
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
        >
          <ArrowLeft className="size-4" aria-hidden />
          Câu trước
        </Button>
        <Button
          variant="outline"
          disabled={index >= exercises.length - 1}
          onClick={() => setIndex((i) => Math.min(exercises.length - 1, i + 1))}
        >
          Câu sau
          <ArrowRight className="size-4" aria-hidden />
        </Button>
        <Button asChild variant="ghost" className="ml-auto">
          <Link href={backHref}>Quay lại bài học</Link>
        </Button>
      </div>

      {/* Finish */}
      {completion ? (
        <section className="surface space-y-2 border-emerald-500/40 bg-emerald-500/5 p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
            <Trophy className="size-4" aria-hidden />
            Đã hoàn thành bài học
          </h2>
          <p className="text-sm text-muted-foreground">
            +{completion.xpAwarded} XP · streak {completion.newStreak} ngày
            {completion.badges.length > 0 && ` · ${completion.badges.length} huy hiệu mới`}
          </p>
          {progress.awaitingReview > 0 && (
            <p className="text-xs text-muted-foreground">
              {progress.awaitingReview} bài còn chờ người chấm — điểm sẽ được cộng thêm sau
              khi chấm xong.
            </p>
          )}
          <Button asChild variant="outline" className="mt-1">
            <Link href={backHref}>Quay lại bài học</Link>
          </Button>
        </section>
      ) : (
        <section className="surface flex flex-wrap items-center gap-3 p-4">
          <ClipboardCheck className="size-5 shrink-0 text-muted-foreground" aria-hidden />
          <p className="min-w-0 flex-1 text-sm text-muted-foreground">
            {progress.allAnswered
              ? 'Đã nộp hết các câu. Chốt bài học để nhận thưởng.'
              : `Còn ${progress.total - progress.answered} câu chưa nộp.`}
          </p>
          <Button onClick={onFinish} disabled={!progress.allAnswered || finishing}>
            {finishing ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : progress.allAnswered ? (
              <CheckCircle2 className="size-4" aria-hidden />
            ) : (
              <Flag className="size-4" aria-hidden />
            )}
            Hoàn thành bài học
          </Button>
        </section>
      )}
    </div>
  );
}
