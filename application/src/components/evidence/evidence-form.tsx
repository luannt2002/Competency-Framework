'use client';

/**
 * Evidence submission form — V8 verified competency engine.
 *
 * Users submit a piece of evidence (lab/project/peer_review/manager_review) for a
 * single skill. The server action recomputes confidence and may promote the
 * user's level_source to 'verified' if thresholds are met. The form is intended
 * to be embedded inside a Dialog from the skill drawer, but also renders fine
 * standalone (see `mode` prop).
 */

import { useId, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Award, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { submitEvidence, type EvidenceKind } from '@/actions/evidence';
import { cn } from '@/lib/utils';

type EvidenceFormProps = {
  workspaceSlug: string;
  skillId: string;
  skillName?: string;
  /** Called after a successful submission so the parent can close a dialog etc. */
  onSubmitted?: () => void;
  className?: string;
};

const KINDS: ReadonlyArray<{ value: EvidenceKind; label: string; hint: string }> = [
  { value: 'lab', label: 'Lab', hint: 'Hands-on exercise (weight 0.30)' },
  { value: 'project', label: 'Project', hint: 'Real-world deliverable (weight 0.40)' },
  { value: 'peer_review', label: 'Peer review', hint: 'Reviewed by a peer (weight 0.15)' },
  { value: 'manager_review', label: 'Manager review', hint: 'Reviewed by a manager (weight 0.15)' },
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

  const [kind, setKind] = useState<EvidenceKind>('lab');
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
                    ? 'border-cyan-400/60 bg-cyan-500/10'
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
          className="w-full accent-cyan-400"
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
