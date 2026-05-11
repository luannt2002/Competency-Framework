'use client';

/**
 * Lesson Runner — Duolingo-style state machine.
 *
 * Phases: intro → exercise → feedback → (next exercise OR review queue) → end
 *
 * Renders a different exercise component per `kind`.
 * MVP: mcq, mcq_multi, fill_blank, type_answer, order_steps, code_block_review.
 */

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  CheckCircle2,
  Flame,
  Heart,
  Loader2,
  Sparkles,
  X,
  XCircle,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  submitExercise,
  completeLesson,
  type LessonRunData,
  type SubmitResult,
} from '@/actions/learn';
import { McqExercise } from './mcq';
import { FillBlankExercise } from './fill-blank';
import { TypeAnswerExercise } from './type-answer';

type Phase = 'intro' | 'exercise' | 'feedback' | 'end';

type Props = {
  workspaceSlug: string;
  data: LessonRunData;
  backHref: string;
};

export function LessonRunner({ workspaceSlug, data, backHref }: Props) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('intro');
  const [idx, setIdx] = useState(0);
  const [answer, setAnswer] = useState<unknown>(null);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [reviewQueue, setReviewQueue] = useState<typeof data.exercises>([]);
  const [isReviewing, setIsReviewing] = useState(false);
  const [totalXp, setTotalXp] = useState(0);
  const [heartsLeft, setHeartsLeft] = useState(5);
  const [completeData, setCompleteData] = useState<{
    xp: number;
    streakTicked: boolean;
    newStreak: number;
  } | null>(null);
  const startedAtRef = useRef<number>(Date.now());

  const totalExercises = data.exercises.length;
  const currentList = isReviewing ? reviewQueue : data.exercises;
  const current = currentList[idx];
  const progress = totalExercises === 0 ? 0 : Math.min(1, (idx + (phase === 'feedback' ? 1 : 0)) / Math.max(1, currentList.length));

  // Reset timer when entering a new exercise
  useEffect(() => {
    if (phase === 'exercise') startedAtRef.current = Date.now();
  }, [phase, idx]);

  const onBeginExercises = () => {
    if (totalExercises === 0) {
      setPhase('end');
      return;
    }
    setPhase('exercise');
  };

  const onCheck = async () => {
    if (!current || submitting) return;
    setSubmitting(true);
    try {
      const res = await submitExercise({
        workspaceSlug,
        lessonId: data.lessonId,
        exerciseId: current.id,
        answer,
        timeTakenMs: Date.now() - startedAtRef.current,
        isRetry: isReviewing,
      });
      setResult(res);
      setTotalXp((x) => x + res.xpAwarded);
      setHeartsLeft(res.heartsLeft);
      if (!res.isCorrect && !isReviewing) {
        setReviewQueue((q) => [...q, current]);
      }
      setPhase('feedback');
    } finally {
      setSubmitting(false);
    }
  };

  const onContinue = async () => {
    setResult(null);
    setAnswer(null);

    const nextIdx = idx + 1;
    if (nextIdx < currentList.length) {
      setIdx(nextIdx);
      setPhase('exercise');
      return;
    }

    // Main queue finished
    if (!isReviewing && reviewQueue.length > 0) {
      setIsReviewing(true);
      setIdx(0);
      setPhase('exercise');
      return;
    }

    // Done — complete lesson
    const correctCount =
      totalExercises +
      reviewQueue.length -
      (isReviewing ? 0 : reviewQueue.length); // simplification
    const scorePct = totalExercises === 0 ? 1 : Math.max(0, 1 - reviewQueue.length / totalExercises);
    const completeRes = await completeLesson({
      workspaceSlug,
      lessonId: data.lessonId,
      scorePct,
    });
    setCompleteData({
      xp: completeRes.xpAwarded,
      streakTicked: completeRes.streakTicked,
      newStreak: completeRes.newStreak,
    });
    setTotalXp((x) => x + completeRes.xpAwarded);
    setPhase('end');
  };

  /* ============== UI ============== */

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Topbar */}
      <header className="flex items-center gap-4 border-b border-border px-4 py-3 md:px-6">
        <button
          type="button"
          onClick={() => router.push(backHref)}
          className="rounded-lg p-1 hover:bg-secondary"
          aria-label="Quit lesson"
        >
          <X className="size-5" />
        </button>

        <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
          <div
            className="h-full accent-gradient transition-all duration-500"
            style={{ width: `${progress * 100}%` }}
          />
        </div>

        <div className="flex items-center gap-1 rounded-full border border-border bg-secondary/50 px-2.5 py-1 text-xs font-semibold tabular-nums">
          <Heart className="size-3.5 text-red-400" />
          {heartsLeft}
        </div>
        <div className="flex items-center gap-1 rounded-full border border-border bg-secondary/50 px-2.5 py-1 text-xs font-semibold tabular-nums">
          <Zap className="size-3.5 text-amber-400" />
          {totalXp}
        </div>
      </header>

      {/* Body */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-4 md:px-6 py-8 md:py-12">
          {phase === 'intro' && (
            <IntroScreen data={data} onBegin={onBeginExercises} />
          )}

          {phase === 'exercise' && current && (
            <ExerciseShell
              prompt={current.promptMd}
              index={idx}
              total={currentList.length}
              isReview={isReviewing}
            >
              {current.kind === 'mcq' || current.kind === 'code_block_review' ? (
                <McqExercise payload={current.payload} answer={answer} onChange={setAnswer} />
              ) : current.kind === 'fill_blank' ? (
                <FillBlankExercise payload={current.payload} answer={answer} onChange={setAnswer} />
              ) : current.kind === 'type_answer' ? (
                <TypeAnswerExercise payload={current.payload} answer={answer} onChange={setAnswer} />
              ) : (
                <UnsupportedKind kind={current.kind} />
              )}
            </ExerciseShell>
          )}

          {phase === 'feedback' && result && (
            <FeedbackPanel result={result} />
          )}

          {phase === 'end' && (
            <EndScreen
              totalXp={totalXp}
              wrongCount={reviewQueue.length}
              total={totalExercises}
              completeData={completeData}
              backHref={backHref}
            />
          )}
        </div>
      </main>

      {/* Footer */}
      {phase === 'exercise' && (
        <footer className="border-t border-border p-4 md:p-6">
          <div className="mx-auto max-w-2xl">
            <Button
              onClick={onCheck}
              disabled={answer === null || submitting}
              className="w-full"
              size="lg"
            >
              {submitting ? <Loader2 className="size-4 animate-spin" /> : 'Check'}
            </Button>
          </div>
        </footer>
      )}

      {phase === 'feedback' && result && (
        <footer
          className={cn(
            'border-t p-4 md:p-6 transition-colors',
            result.isCorrect
              ? 'border-emerald-500/40 bg-emerald-500/5'
              : 'border-destructive/40 bg-destructive/5',
          )}
        >
          <div className="mx-auto max-w-2xl">
            <Button onClick={onContinue} className="w-full" size="lg">
              Continue <ArrowRight className="size-4" />
            </Button>
          </div>
        </footer>
      )}
    </div>
  );
}

function IntroScreen({ data, onBegin }: { data: LessonRunData; onBegin: () => void }) {
  return (
    <div className="text-center space-y-6 animate-fade-in">
      <div className="mx-auto size-16 rounded-2xl accent-gradient flex items-center justify-center">
        <Sparkles className="size-8 text-white" />
      </div>
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{data.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {data.exercises.length} exercises · ~{data.estMinutes} minutes
        </p>
      </div>
      {data.introMd && (
        <div className="surface p-6 text-left text-sm leading-relaxed">
          {data.introMd.split('\n').map((line, i) => (
            <p key={i} className="not-first:mt-2">
              {line}
            </p>
          ))}
        </div>
      )}
      <Button onClick={onBegin} size="lg" className="px-8">
        Begin <ArrowRight className="size-4" />
      </Button>
    </div>
  );
}

function ExerciseShell({
  prompt,
  index,
  total,
  isReview,
  children,
}: {
  prompt: string;
  index: number;
  total: number;
  isReview: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="font-mono">
          {index + 1}/{total}
        </span>
        {isReview && (
          <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-400 font-semibold">
            REVIEW
          </span>
        )}
      </div>
      <h2 className="text-xl md:text-2xl font-semibold leading-snug">{prompt}</h2>
      <div>{children}</div>
    </div>
  );
}

function FeedbackPanel({ result }: { result: SubmitResult }) {
  return (
    <div
      className={cn(
        'surface p-6 animate-slide-up',
        result.isCorrect
          ? 'border-emerald-500/30 bg-emerald-500/5'
          : 'border-destructive/30 bg-destructive/5',
      )}
    >
      <div className="flex items-center gap-3">
        {result.isCorrect ? (
          <CheckCircle2 className="size-8 text-emerald-400" />
        ) : (
          <XCircle className="size-8 text-destructive" />
        )}
        <div>
          <h3 className="text-lg font-semibold">
            {result.isCorrect ? 'Correct! 🎉' : 'Not quite'}
          </h3>
          {result.isCorrect && result.xpAwarded > 0 && (
            <p className="text-sm text-amber-400 font-medium">
              +{result.xpAwarded} XP
            </p>
          )}
        </div>
      </div>
      {result.explanationMd && (
        <div className="mt-4 text-sm leading-relaxed text-muted-foreground">
          {result.explanationMd}
        </div>
      )}
    </div>
  );
}

function EndScreen({
  totalXp,
  wrongCount,
  total,
  completeData,
  backHref,
}: {
  totalXp: number;
  wrongCount: number;
  total: number;
  completeData: { xp: number; streakTicked: boolean; newStreak: number } | null;
  backHref: string;
}) {
  const router = useRouter();
  const accuracy = total === 0 ? 100 : Math.round(((total - wrongCount) / total) * 100);
  return (
    <div className="text-center space-y-6 animate-fade-in">
      <div className="mx-auto size-20 rounded-3xl accent-gradient flex items-center justify-center shadow-2xl shadow-cyan-500/30">
        <Sparkles className="size-10 text-white" />
      </div>
      <div>
        <h1 className="text-4xl font-bold tracking-tight">Lesson complete!</h1>
        <p className="mt-2 text-muted-foreground">
          {accuracy === 100 ? '⭐ Perfect run · Mastered' : `${accuracy}% accuracy`}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="surface p-5">
          <div className="text-3xl font-bold tabular-nums accent-gradient-text">+{totalXp}</div>
          <div className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
            <Zap className="size-3 text-amber-400" />
            XP earned
          </div>
        </div>
        <div className="surface p-5">
          <div className="text-3xl font-bold tabular-nums text-orange-400">
            {completeData?.newStreak ?? 0}
          </div>
          <div className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
            <Flame className="size-3 text-orange-400" />
            Day streak {completeData?.streakTicked ? '· +1!' : ''}
          </div>
        </div>
      </div>

      <div className="flex gap-2 justify-center">
        <Button variant="outline" onClick={() => router.push(backHref)}>
          Back to week
        </Button>
        <Button onClick={() => router.push(backHref)}>
          Continue <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function UnsupportedKind({ kind }: { kind: string }) {
  return (
    <div className="surface p-6 text-sm text-muted-foreground">
      Exercise type <code className="text-foreground">{kind}</code> is not yet supported in the
      MVP runner. Skipped — click Check to continue.
    </div>
  );
}
