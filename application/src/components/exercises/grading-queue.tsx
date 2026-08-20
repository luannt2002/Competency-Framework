'use client';

/**
 * GradingQueue — the manual-grading surface for EDITOR+.
 *
 * One card per attempt awaiting review, oldest first. The card shows the
 * prompt, the learner's submission, and a scoring control that adapts to the
 * kind: a weighted criterion list for rubric exercises, a single 0-100 field
 * for everything else. The weighted preview is computed client-side purely as
 * feedback — the authoritative total is recomputed by the rubric engine on the
 * server, so a tampered form can't invent a grade.
 *
 * All data arrives as props from the server component; this file holds no
 * business data of its own.
 */
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { CheckCircle2, Loader2, MessageSquareText, User2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { MarkdownRenderer } from '@/components/learn/markdown-renderer';
import { gradeSubmission } from '@/actions/learn';

export type GradingCriterion = { id: string; label: string; weight: number };

export type GradingItem = {
  attemptId: string;
  exerciseId: string;
  lessonTitle: string | null;
  userId: string;
  kind: string;
  typeLabel: string;
  engine: string;
  promptMd: string;
  answer: unknown;
  criteria: GradingCriterion[];
  xpAward: number;
  submittedAt: string | null;
};

/** Render any answer shape as readable text without guessing at semantics. */
function answerToText(answer: unknown): string {
  if (answer === null || answer === undefined) return '';
  if (typeof answer === 'string') return answer;
  if (typeof answer === 'number' || typeof answer === 'boolean') return String(answer);
  try {
    return JSON.stringify(answer, null, 2);
  } catch {
    return String(answer);
  }
}

function formatWhen(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString();
}

export function GradingQueue({
  workspaceSlug,
  items,
}: {
  workspaceSlug: string;
  items: GradingItem[];
}) {
  return (
    <div className="space-y-5">
      {items.map((item) => (
        <GradingCard key={item.attemptId} workspaceSlug={workspaceSlug} item={item} />
      ))}
    </div>
  );
}

function GradingCard({
  workspaceSlug,
  item,
}: {
  workspaceSlug: string;
  item: GradingItem;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [percent, setPercent] = useState('');
  const [criterionPercents, setCriterionPercents] = useState<Record<string, string>>({});

  const isRubric = item.criteria.length > 0;

  // Mirrors weightedRubricScore() on the server: weighted mean, missing
  // criteria count as zero. Preview only.
  const preview = useMemo(() => {
    if (!isRubric) return null;
    const totalWeight = item.criteria.reduce((sum, c) => sum + c.weight, 0);
    if (totalWeight === 0) return 0;
    const earned = item.criteria.reduce((sum, c) => {
      const raw = Number(criterionPercents[c.id] ?? '');
      const pct = Number.isFinite(raw) ? Math.min(100, Math.max(0, raw)) : 0;
      return sum + c.weight * (pct / 100);
    }, 0);
    return Math.round((earned / totalWeight) * 100);
  }, [isRubric, item.criteria, criterionPercents]);

  const canSubmit = isRubric
    ? Object.keys(criterionPercents).length > 0
    : percent.trim() !== '' && Number.isFinite(Number(percent));

  const submit = () => {
    if (!canSubmit || pending) return;
    startTransition(async () => {
      try {
        const payload = isRubric
          ? {
              workspaceSlug,
              attemptId: item.attemptId,
              rubricScores: Object.fromEntries(
                item.criteria.map((c) => {
                  const raw = Number(criterionPercents[c.id] ?? '');
                  const pct = Number.isFinite(raw) ? Math.min(100, Math.max(0, raw)) : 0;
                  return [c.id, pct / 100];
                }),
              ),
              feedbackMd: feedback.trim() || undefined,
            }
          : {
              workspaceSlug,
              attemptId: item.attemptId,
              score: Math.min(100, Math.max(0, Number(percent))) / 100,
              feedbackMd: feedback.trim() || undefined,
            };

        const res = await gradeSubmission(payload);
        setDone(true);
        toast.success('Đã chấm', {
          description: `${res.status} · ${Math.round(res.score * 100)}% · +${res.xpAwarded} XP`,
        });
        router.refresh();
      } catch (e) {
        toast.error('Chấm thất bại', { description: String(e) });
      }
    });
  };

  if (done) {
    // "Done" styling copied from node-card.tsx so a graded card reads the same
    // as a completed node elsewhere in the app.
    return (
      <div className="surface flex items-center gap-3 border-emerald-500/40 bg-emerald-500/5 p-4 text-sm">
        <CheckCircle2 className="size-5 shrink-0 text-emerald-700 dark:text-emerald-400" />
        <span className="text-muted-foreground">
          Đã chấm xong bài này. Danh sách sẽ cập nhật khi tải lại.
        </span>
      </div>
    );
  }

  return (
    <article className="surface overflow-hidden">
      <header className="flex flex-wrap items-center gap-2 border-b border-border bg-secondary/30 px-4 py-3">
        <Badge variant="secondary">{item.typeLabel}</Badge>
        <span className="text-sm font-medium truncate">
          {item.lessonTitle ?? 'Bài học đã xoá'}
        </span>
        <span className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <User2 className="size-3" aria-hidden />
            <span className="font-mono">{item.userId.slice(0, 8)}</span>
          </span>
          <time dateTime={item.submittedAt ?? undefined}>{formatWhen(item.submittedAt)}</time>
        </span>
      </header>

      <div className="grid gap-4 p-4 md:grid-cols-2">
        <section aria-label="Đề bài" className="min-w-0 space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Đề bài
          </h3>
          <div className="rounded-xl border border-border bg-secondary/20 p-3 text-sm">
            <MarkdownRenderer>{item.promptMd}</MarkdownRenderer>
          </div>
        </section>

        <section aria-label="Bài làm" className="min-w-0 space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Bài làm
          </h3>
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-border bg-secondary/20 p-3 text-sm">
            {answerToText(item.answer) || '(trống)'}
          </pre>
        </section>
      </div>

      <div className="space-y-4 border-t border-border p-4">
        {isRubric ? (
          <fieldset className="space-y-2">
            <legend className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Tiêu chí (0–100 mỗi tiêu chí)
            </legend>
            {item.criteria.map((c) => (
              <div key={c.id} className="flex items-center gap-3">
                <label
                  htmlFor={`crit-${item.attemptId}-${c.id}`}
                  className="min-w-0 flex-1 truncate text-sm"
                >
                  {c.label}
                  <span className="ml-2 text-xs text-muted-foreground">
                    trọng số {c.weight}
                  </span>
                </label>
                <Input
                  id={`crit-${item.attemptId}-${c.id}`}
                  type="number"
                  min={0}
                  max={100}
                  inputMode="numeric"
                  className="w-24"
                  value={criterionPercents[c.id] ?? ''}
                  onChange={(e) =>
                    setCriterionPercents((prev) => ({ ...prev, [c.id]: e.target.value }))
                  }
                />
              </div>
            ))}
            <p className="text-xs text-muted-foreground" aria-live="polite">
              Tổng có trọng số (tạm tính): <strong>{preview ?? 0}%</strong> — điểm chính
              thức do server tính lại.
            </p>
          </fieldset>
        ) : (
          <div className="flex items-center gap-3">
            <label
              htmlFor={`score-${item.attemptId}`}
              className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Điểm (0–100)
            </label>
            <Input
              id={`score-${item.attemptId}`}
              type="number"
              min={0}
              max={100}
              inputMode="numeric"
              className="w-28"
              value={percent}
              onChange={(e) => setPercent(e.target.value)}
            />
            <span className="text-xs text-muted-foreground">
              Tối đa {item.xpAward} XP theo tỉ lệ điểm
            </span>
          </div>
        )}

        <div className="space-y-1.5">
          <label
            htmlFor={`fb-${item.attemptId}`}
            className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
          >
            <MessageSquareText className="size-3" aria-hidden />
            Nhận xét (markdown)
          </label>
          <Textarea
            id={`fb-${item.attemptId}`}
            rows={3}
            value={feedback}
            placeholder="Điều đã tốt, điều cần sửa…"
            onChange={(e) => setFeedback(e.target.value)}
          />
        </div>

        <div className="flex justify-end">
          <Button onClick={submit} disabled={!canSubmit || pending}>
            {pending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <CheckCircle2 className="size-4" aria-hidden />
            )}
            Chấm điểm
          </Button>
        </div>
      </div>
    </article>
  );
}
