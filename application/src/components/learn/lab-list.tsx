'use client';

/**
 * Lab list — hands-on tasks for a week. Mark-done with evidence URLs.
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Beaker, CheckCircle2, Circle, ExternalLink, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { markLabDone, unmarkLab, type LabWithProgress } from '@/actions/labs';
import { cn } from '@/lib/utils';

type Props = {
  workspaceSlug: string;
  labs: LabWithProgress[];
};

export function LabList({ workspaceSlug, labs }: Props) {
  const [selected, setSelected] = useState<LabWithProgress | null>(null);

  if (labs.length === 0) {
    return (
      <section className="surface p-4 border-dashed border-cyan-500/20 bg-cyan-500/5">
        <div className="flex items-start gap-3">
          <Beaker className="size-5 text-cyan-400 mt-0.5" />
          <div>
            <p className="text-sm font-medium">No labs for this week yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Labs are hands-on tasks (vs lessons = bite-sized study). Seed labs by adding to{' '}
              <code className="text-foreground">drizzle/seeds/devops.json</code> under each week.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="surface overflow-hidden">
        <header className="p-4 border-b border-border bg-secondary/20 flex items-center gap-2">
          <Beaker className="size-4 text-cyan-400" />
          <h3 className="font-semibold text-sm">Hands-on Labs</h3>
          <span className="text-xs text-muted-foreground">({labs.length})</span>
          <span className="ml-auto text-xs text-amber-400 font-mono">+50 XP each</span>
        </header>
        <ul className="divide-y divide-border">
          {labs.map((lab) => {
            const done = lab.status === 'done';
            return (
              <li
                key={lab.id}
                onClick={() => setSelected(lab)}
                className={cn(
                  'p-4 cursor-pointer transition-colors',
                  done ? 'bg-emerald-500/5 hover:bg-emerald-500/10' : 'hover:bg-secondary/40',
                )}
              >
                <div className="flex items-start gap-3">
                  {done ? (
                    <CheckCircle2 className="size-5 text-emerald-400 mt-0.5 shrink-0" />
                  ) : (
                    <Circle className="size-5 text-muted-foreground mt-0.5 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-sm font-medium', done && 'line-through text-muted-foreground')}>
                      {lab.title}
                    </p>
                    {lab.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {lab.description}
                      </p>
                    )}
                    {(lab.evidenceUrls?.length ?? 0) > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {lab.evidenceUrls!.slice(0, 3).map((u, i) => (
                          <a
                            key={i}
                            href={u}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-[10px] text-primary hover:underline inline-flex items-center gap-0.5"
                          >
                            <ExternalLink className="size-2.5" />
                            evidence
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                    ~{lab.estMinutes ?? 30}m
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {selected && (
        <LabDetailDialog
          lab={selected}
          workspaceSlug={workspaceSlug}
          open
          onOpenChange={(v) => !v && setSelected(null)}
        />
      )}
    </>
  );
}

function LabDetailDialog({
  lab,
  workspaceSlug,
  open,
  onOpenChange,
}: {
  lab: LabWithProgress;
  workspaceSlug: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const [evidence, setEvidence] = useState((lab.evidenceUrls ?? []).join('\n'));
  const [note, setNote] = useState(lab.note ?? '');
  const [pending, startTransition] = useTransition();
  const isDone = lab.status === 'done';

  const evidenceUrls = evidence
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

  const submit = () => {
    startTransition(async () => {
      try {
        for (const u of evidenceUrls) {
          try {
            new URL(u);
          } catch {
            toast.error(`Invalid URL: ${u}`);
            return;
          }
        }
        await markLabDone({
          workspaceSlug,
          labId: lab.id,
          evidenceUrls,
          note: note.trim() || undefined,
        });
        toast.success(isDone ? 'Lab updated' : 'Lab completed!', {
          description: !isDone ? '+50 XP earned' : undefined,
        });
        onOpenChange(false);
        router.refresh();
      } catch (e) {
        toast.error('Save failed', { description: String(e) });
      }
    });
  };

  const undo = () => {
    if (!window.confirm('Unmark this lab as done?')) return;
    startTransition(async () => {
      try {
        await unmarkLab(workspaceSlug, lab.id);
        toast.success('Lab reverted to todo');
        onOpenChange(false);
        router.refresh();
      } catch (e) {
        toast.error('Revert failed', { description: String(e) });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Beaker className="size-5 text-cyan-400" />
            <DialogTitle>{lab.title}</DialogTitle>
          </div>
          {lab.description && <DialogDescription>{lab.description}</DialogDescription>}
        </DialogHeader>

        {lab.bodyMd && (
          <div className="text-sm whitespace-pre-wrap leading-relaxed text-muted-foreground border-l-2 border-cyan-500/30 pl-3 max-h-40 overflow-y-auto">
            {lab.bodyMd}
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium block mb-1.5">
              Evidence URLs <span className="text-muted-foreground">(GitHub repo, blog, screenshot — one per line)</span>
            </label>
            <Textarea
              value={evidence}
              onChange={(e) => setEvidence(e.target.value)}
              rows={3}
              placeholder="https://github.com/you/repo&#10;https://blog.example.com/post"
              className="font-mono text-xs"
            />
          </div>

          <div>
            <label className="text-xs font-medium block mb-1.5">Note (optional)</label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="What was tricky? What did you learn?"
            />
          </div>
        </div>

        <DialogFooter>
          {isDone && (
            <Button variant="outline" onClick={undo} disabled={pending}>
              Mark as todo
            </Button>
          )}
          <Button onClick={submit} disabled={pending}>
            {pending && <Loader2 className="size-3 animate-spin" />}
            {isDone ? 'Update' : 'Mark as Done (+50 XP)'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
