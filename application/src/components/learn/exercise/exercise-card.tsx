'use client';

/**
 * One exercise, end to end: the prompt, the widget, the verdict.
 *
 * Presentation only. Every decision it looks like it is making — which widget,
 * whether the draft is submittable, whether the explanation may be shown — was
 * made in `@/lib/exercises/runner` and arrives as props. The card's own job is
 * to lay out what an exercise puts on screen and to keep the manual-grading
 * case visually distinct BEFORE submission, so nobody is surprised that their
 * essay did not turn green.
 */
import { Clock3, Loader2, RotateCcw, Send, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MarkdownRenderer } from '@/components/learn/markdown-renderer';
import { AnswerInput } from './answer-input';
import { VerdictBanner } from './verdict-banner';
import { cn } from '@/lib/utils';
import {
  readCode,
  readCriteria,
  readGuidance,
  readHint,
  readQuestion,
  verdictTone,
  type AnswerDraft,
  type ExerciseOutcome,
  type RunnerSpec,
} from '@/lib/exercises/runner';
import type { LessonRunData } from '@/actions/learn';

export type RunnerExercise = LessonRunData['exercises'][number];

/** Everything the runner knows about one exercise right now. */
export type ExerciseUiState = {
  draft: AnswerDraft;
  outcome: ExerciseOutcome | null;
  /** Engine note from the most recent submit in this session. */
  feedback: string | null;
  /** Released only once the attempt is settled. */
  explanationMd: string | null;
  xpAwarded: number | null;
  submitting: boolean;
  error: string | null;
  /** True after the learner asked to try again — unlocks a settled-wrong card. */
  retrying: boolean;
};

export function ExerciseCard({
  exercise,
  spec,
  state,
  index,
  total,
  ready,
  onChange,
  onSubmit,
  onRetry,
}: {
  exercise: RunnerExercise;
  spec: RunnerSpec;
  state: ExerciseUiState;
  index: number;
  total: number;
  /** `isDraftReady` result — computed by the runner, not re-derived here. */
  ready: boolean;
  onChange: (draft: AnswerDraft) => void;
  onSubmit: () => void;
  onRetry: () => void;
}) {
  const { outcome } = state;
  const tone = verdictTone(outcome?.status ?? null);
  const awaiting = outcome?.awaitingReview === true;
  const settledWrong = tone === 'incorrect' || tone === 'partial';
  const done = tone === 'correct';
  const manual = exercise.gradingMode !== 'auto';

  // Locked whenever there is nothing useful to resubmit: already correct, or
  // waiting on a human. A settled-wrong card unlocks through "Làm lại".
  const locked = done || awaiting || (settledWrong && !state.retrying);

  const code = readCode(exercise.payload);
  const question = readQuestion(exercise.payload);
  const guidance = readGuidance(exercise.payload);
  const criteria = readCriteria(exercise.payload);
  const hint = readHint(exercise.payload);

  return (
    <article className="surface overflow-hidden">
      <header className="flex flex-wrap items-center gap-2 border-b border-border bg-secondary/30 px-4 py-3">
        <span className="text-xs font-semibold tabular-nums text-muted-foreground">
          Câu {index + 1}/{total}
        </span>
        <Badge variant="secondary">{exercise.typeLabel}</Badge>
        {manual && (
          <Badge variant="outline" className="text-muted-foreground">
            <Clock3 className="size-3" aria-hidden />
            Người chấm
          </Badge>
        )}
        <span className="ml-auto flex items-center gap-1 text-xs tabular-nums text-muted-foreground">
          <Sparkles className="size-3" aria-hidden />
          {exercise.xpAward} XP
        </span>
      </header>

      <div className="space-y-4 p-4 md:p-5">
        <div className="text-sm">
          <MarkdownRenderer>{exercise.promptMd}</MarkdownRenderer>
        </div>

        {code && (
          <div className="text-sm">
            {/* Reuses the markdown code block: language tag + copy button,
                identical to how code reads everywhere else in the app. */}
            <MarkdownRenderer>{`\`\`\`${code.language}\n${code.code}\n\`\`\``}</MarkdownRenderer>
          </div>
        )}

        {question && <p className="text-sm font-medium">{question}</p>}

        {guidance && (
          <div className="rounded-xl border border-border bg-secondary/20 p-3 text-sm">
            <MarkdownRenderer>{guidance}</MarkdownRenderer>
          </div>
        )}

        {criteria.length > 0 && (
          <section className="rounded-xl border border-border bg-secondary/20 p-3">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Bạn sẽ được chấm theo
            </h3>
            <ul className="space-y-1">
              {criteria.map((c) => (
                <li key={c.id} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0">{c.label}</span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    trọng số {c.weight}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Said before the learner writes, not after they are confused by a
            grey banner: manual kinds never produce an instant verdict. Shown
            whenever the box is writable, including a retry. */}
        {manual && !locked && (
          <p className="flex items-start gap-2 rounded-xl border border-border bg-secondary/30 p-3 text-xs text-muted-foreground">
            <Clock3 className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>
              Dạng bài này do người chấm đọc và cho điểm. Nộp xong bài sẽ vào hàng đợi chấm,
              chưa có điểm ngay.
            </span>
          </p>
        )}

        <AnswerInput
          idBase={`ex-${exercise.id}`}
          spec={spec}
          draft={state.draft}
          disabled={locked || state.submitting}
          onChange={onChange}
        />

        {hint && <p className="text-xs text-muted-foreground">Gợi ý: {hint}</p>}

        {state.error && (
          <p className="text-sm text-destructive" role="alert">
            {state.error}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {!locked && (
            <Button onClick={onSubmit} disabled={!ready || state.submitting}>
              {state.submitting ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Send className="size-4" aria-hidden />
              )}
              {manual ? 'Nộp bài' : 'Kiểm tra'}
            </Button>
          )}
          {settledWrong && !state.retrying && (
            <Button variant="outline" onClick={onRetry}>
              <RotateCcw className="size-4" aria-hidden />
              Làm lại
            </Button>
          )}
          {outcome && outcome.attemptCount > 0 && (
            <span className={cn('text-xs tabular-nums text-muted-foreground')}>
              {outcome.attemptCount} lần nộp
            </span>
          )}
        </div>

        {tone && (
          <VerdictBanner
            tone={tone}
            score={outcome?.score ?? 0}
            feedback={state.feedback}
            graderFeedbackMd={outcome?.feedbackMd ?? null}
            explanationMd={state.explanationMd}
            xpAwarded={state.xpAwarded}
          />
        )}
      </div>
    </article>
  );
}
