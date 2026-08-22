'use client';

/**
 * Evidence submission form — V8 verified competency engine.
 *
 * Người học tự nộp một bằng chứng (lab / project) cho MỘT kỹ năng. Server action
 * tính lại độ tin cậy và ghi lại dấu vết "đã học".
 *
 * Nộp bằng chứng KHÔNG nâng được lên `verified` — việc đó chỉ xảy ra khi người
 * KHÁC (EDITOR trở lên) bấm Duyệt trong drawer kỹ năng. Xem chú thích ở
 * `submitInput` trong src/actions/evidence.ts để biết vì sao.
 *
 * Form này nhúng trong Dialog của skill drawer, nhưng đứng riêng cũng render
 * được.
 */

import { useId, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Award, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { submitEvidence, type SelfEvidenceKind } from '@/actions/evidence';
import { cn } from '@/lib/utils';

type EvidenceFormProps = {
  workspaceSlug: string;
  skillId: string;
  skillName?: string;
  /** Called after a successful submission so the parent can close a dialog etc. */
  onSubmitted?: () => void;
  className?: string;
};

/**
 * Chỉ hai dạng TỰ LÀM.
 *
 * `peer_review` / `manager_review` mô tả việc người khác đã xem xét, nên không
 * thuộc về một biểu mẫu mà người học tự điền cho chính mình. Trước đợt này form
 * phơi cả bốn: chọn "Manager review" + nhập 100 là kỹ năng lên thẳng `verified`
 * vĩnh viễn mà không ai duyệt. Đường duyệt nằm ở nút Duyệt trong drawer kỹ
 * năng, do người khác (EDITOR trở lên) bấm.
 *
 * `submitEvidence` cũng đã chặn ở enum đầu vào — đây chỉ là để người dùng không
 * nhìn thấy một cánh cửa đã khoá.
 */
const KINDS: ReadonlyArray<{ value: SelfEvidenceKind; label: string; hint: string }> = [
  { value: 'lab', label: 'Lab', hint: 'Hands-on exercise (weight 0.30)' },
  { value: 'project', label: 'Project', hint: 'Real-world deliverable (weight 0.40)' },
];

export function EvidenceForm({
  workspaceSlug,
  skillId,
  skillName,
  onSubmitted,
  className,
}: EvidenceFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [kind, setKind] = useState<SelfEvidenceKind>('lab');
  const [score, setScore] = useState<number>(70);
  const [evidenceUrl, setEvidenceUrl] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [urlError, setUrlError] = useState<string | null>(null);

  const formId = useId();
  const kindId = `${formId}-kind`;
  const scoreId = `${formId}-score`;
  const urlId = `${formId}-url`;
  const noteId = `${formId}-note`;

  function validateUrl(value: string): boolean {
    if (value.length === 0) {
      setUrlError(null);
      return true;
    }
    try {
      // URL constructor throws on invalid URLs.
      new URL(value);
      setUrlError(null);
      return true;
    } catch {
      setUrlError('Must be a valid URL (https://...)');
      return false;
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validateUrl(evidenceUrl)) return;

    startTransition(async () => {
      try {
        const res = await submitEvidence({
          workspaceSlug,
          skillId,
          kind,
          score,
          evidenceUrl: evidenceUrl.length > 0 ? evidenceUrl : undefined,
          note: note.length > 0 ? note : undefined,
        });

        const baseMsg = skillName ? `Evidence saved for ${skillName}` : 'Evidence saved';
        if (res.promotedToVerified) {
          toast.success(`${baseMsg} — skill VERIFIED (confidence ${res.confidence.score})`, {
            icon: <Award className="size-4 text-amber-400" />,
          });
        } else {
          toast.success(`${baseMsg} (confidence ${res.confidence.score})`);
        }

        // Reset form, then notify parent and refresh.
        setEvidenceUrl('');
        setNote('');
        setScore(70);
        setKind('lab');
        onSubmitted?.();
        router.refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        toast.error(`Failed to submit evidence: ${message}`);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className={cn('flex flex-col gap-4', className)} noValidate>
      {/* Kind */}
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium" id={kindId}>
          Evidence type
        </legend>
        <div
          role="radiogroup"
          aria-labelledby={kindId}
          className="grid grid-cols-2 gap-2"
        >
          {KINDS.map((k) => {
            const selected = kind === k.value;
            return (
              <button
                key={k.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setKind(k.value)}
                className={cn(
                  'flex flex-col items-start gap-0.5 rounded-xl border px-3 py-2 text-left transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  selected
                    ? 'border-hue-1/60 bg-hue-1/10'
                    : 'border-border bg-secondary/30 hover:bg-secondary/60',
                )}
              >
                <span className="text-sm font-medium">{k.label}</span>
                <span className="text-xs text-muted-foreground">{k.hint}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* Score slider */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label htmlFor={scoreId} className="text-sm font-medium">
            Score
          </label>
          <span
            className="rounded-md bg-secondary/60 px-2 py-0.5 text-sm tabular-nums"
            aria-live="polite"
          >
            {score} / 100
          </span>
        </div>
        <input
          id={scoreId}
          type="range"
          min={0}
          max={100}
          step={1}
          value={score}
          onChange={(e) => setScore(Number(e.currentTarget.value))}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={score}
          className="w-full accent-hue-1"
        />
      </div>

      {/* Evidence URL */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor={urlId} className="text-sm font-medium">
          Evidence URL <span className="text-xs text-muted-foreground">(optional)</span>
        </label>
        <Input
          id={urlId}
          type="url"
          inputMode="url"
          placeholder="https://github.com/you/lab-output"
          value={evidenceUrl}
          onChange={(e) => {
            const v = e.currentTarget.value;
            setEvidenceUrl(v);
            validateUrl(v);
          }}
          aria-invalid={urlError !== null}
          aria-describedby={urlError ? `${urlId}-err` : undefined}
        />
        {urlError ? (
          <p id={`${urlId}-err`} className="text-xs text-destructive">
            {urlError}
          </p>
        ) : null}
      </div>

      {/* Note */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor={noteId} className="text-sm font-medium">
          Note <span className="text-xs text-muted-foreground">(optional)</span>
        </label>
        <Textarea
          id={noteId}
          placeholder="What did you build? What did the reviewer say?"
          value={note}
          onChange={(e) => setNote(e.currentTarget.value)}
          rows={4}
          maxLength={5000}
        />
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        <Button type="submit" disabled={isPending || urlError !== null}>
          {isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Submitting…
            </>
          ) : (
            'Submit evidence'
          )}
        </Button>
      </div>
    </form>
  );
}
