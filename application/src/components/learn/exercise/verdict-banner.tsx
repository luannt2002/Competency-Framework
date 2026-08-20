'use client';

/**
 * The result strip under an answered exercise.
 *
 * FOUR outcomes, not two. The old boolean model could only say right/wrong,
 * which is exactly the thing that made essays impossible: a submitted essay is
 * neither. So:
 *
 *   correct   -> emerald   "Chính xác"        + explanation
 *   partial   -> amber     "Đúng một phần"    + score + explanation
 *   incorrect -> destructive "Chưa đúng"      + explanation + retry
 *   pending   -> muted     "Đang chờ chấm"    + NO verdict, NO score, NO explanation
 *
 * The pending branch is load-bearing. Nothing about it may hint at a judgement
 * — no red, no score, no model answer — because at that moment no human has
 * read the work. `score` is 0 for a pending attempt purely as a placeholder,
 * and rendering it would be an outright lie; that is why it is not passed here.
 *
 * Colour vocabulary is borrowed wholesale from node-card.tsx (emerald = done,
 * muted = not started), so a graded exercise reads like a finished node.
 */
import { CheckCircle2, Clock3, Lightbulb, MinusCircle, XCircle } from 'lucide-react';
import { MarkdownRenderer } from '@/components/learn/markdown-renderer';
import { cn } from '@/lib/utils';
import type { VerdictTone } from '@/lib/exercises/runner';

const TONE: Record<
  VerdictTone,
  { icon: typeof CheckCircle2; label: string; surface: string; accent: string }
> = {
  correct: {
    icon: CheckCircle2,
    label: 'Chính xác',
    surface: 'border-emerald-500/40 bg-emerald-500/5',
    accent: 'text-emerald-700 dark:text-emerald-400',
  },
  partial: {
    icon: MinusCircle,
    label: 'Đúng một phần',
    surface: 'border-amber-500/40 bg-amber-500/5',
    accent: 'text-amber-700 dark:text-amber-400',
  },
  incorrect: {
    icon: XCircle,
    label: 'Chưa đúng',
    surface: 'border-destructive/40 bg-destructive/5',
    accent: 'text-destructive',
  },
  pending: {
    icon: Clock3,
    label: 'Đang chờ chấm',
    surface: 'border-border bg-secondary/40',
    accent: 'text-muted-foreground',
  },
};

export type VerdictBannerProps = {
  tone: VerdictTone;
  /** 0..1. Ignored (and must be ignored) when `tone === 'pending'`. */
  score: number;
  /** Engine note — counts, band hints. Never contains the answer. */
  feedback?: string | null;
  /** Human grader's note, markdown. Only present after manual grading. */
  graderFeedbackMd?: string | null;
  /** Author explanation. Caller must not pass one for a pending attempt. */
  explanationMd?: string | null;
  xpAwarded?: number | null;
};

export function VerdictBanner({
  tone,
  score,
  feedback,
  graderFeedbackMd,
  explanationMd,
  xpAwarded,
}: VerdictBannerProps) {
  const meta = TONE[tone];
  const Icon = meta.icon;
  const pending = tone === 'pending';
  const showScore = !pending && tone !== 'correct';

  return (
    <div
      className={cn('space-y-3 rounded-xl border p-4', meta.surface)}
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Icon className={cn('size-5 shrink-0', meta.accent)} aria-hidden />
        <span className={cn('text-sm font-semibold', meta.accent)}>{meta.label}</span>
        {showScore && (
          <span className="text-xs tabular-nums text-muted-foreground">
            {Math.round(score * 100)}%
          </span>
        )}
        {!pending && (xpAwarded ?? 0) > 0 && (
          <span className="ml-auto text-xs font-semibold tabular-nums text-amber-700 dark:text-amber-400">
            +{xpAwarded} XP
          </span>
        )}
      </div>

      {pending && (
        <p className="text-sm text-muted-foreground">
          Bài đã nộp và đang nằm trong hàng đợi chấm. Chưa có điểm — bạn sẽ nhận thông báo
          ngay khi người chấm xong.
        </p>
      )}

      {feedback && <p className="text-sm text-muted-foreground">{feedback}</p>}

      {graderFeedbackMd && (
        <div className="space-y-1 rounded-lg border border-border bg-card p-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Nhận xét của người chấm
          </p>
          <div className="text-sm">
            <MarkdownRenderer>{graderFeedbackMd}</MarkdownRenderer>
          </div>
        </div>
      )}

      {/* Never rendered while pending — the caller withholds it, and
          `mayRevealExplanation` is the rule that decides. */}
      {!pending && explanationMd && (
        <div className="space-y-1 rounded-lg border border-border bg-card p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Lightbulb className="size-3" aria-hidden />
            Giải thích
          </p>
          <div className="text-sm">
            <MarkdownRenderer>{explanationMd}</MarkdownRenderer>
          </div>
        </div>
      )}
    </div>
  );
}
