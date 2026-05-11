'use client';

import { cn } from '@/lib/utils';

type Option = { id: string; text: string };

type Payload = {
  options: Option[];
  multi?: boolean; // for mcq_multi
};

type Props = {
  payload: unknown;
  answer: unknown;
  onChange: (a: unknown) => void;
};

export function McqExercise({ payload, answer, onChange }: Props) {
  const p = payload as Payload | null;
  if (!p || !p.options) return null;
  const multi = p.multi ?? false;
  const selected = multi
    ? (Array.isArray(answer) ? new Set(answer as string[]) : new Set<string>())
    : answer;

  return (
    <div className="space-y-2">
      {p.options.map((opt, i) => {
        const isSelected = multi
          ? (selected as Set<string>).has(opt.id)
          : selected === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => {
              if (multi) {
                const set = new Set(selected as Set<string>);
                set.has(opt.id) ? set.delete(opt.id) : set.add(opt.id);
                onChange(Array.from(set));
              } else {
                onChange(opt.id);
              }
            }}
            className={cn(
              'group flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-all active:scale-[0.99]',
              isSelected
                ? 'border-primary bg-primary/5 ring-2 ring-primary/30'
                : 'border-border bg-card hover:bg-secondary/40',
            )}
          >
            <span
              className={cn(
                'inline-flex size-7 shrink-0 items-center justify-center rounded-lg border font-mono text-xs font-semibold',
                isSelected
                  ? 'border-primary bg-primary/15 text-primary'
                  : 'border-border bg-secondary text-muted-foreground group-hover:text-foreground',
              )}
            >
              {i + 1}
            </span>
            <span className="flex-1 text-sm">{opt.text}</span>
          </button>
        );
      })}
    </div>
  );
}
