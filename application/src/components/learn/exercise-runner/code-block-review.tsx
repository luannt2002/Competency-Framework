'use client';

/**
 * Code Block Review — show a code snippet + multiple choice for "what's wrong".
 */

import { cn } from '@/lib/utils';

type Option = { id: string; text: string };
type Payload = {
  code: string;
  language?: string;
  question?: string;
  options: Option[];
};

type Props = {
  payload: unknown;
  answer: unknown;
  onChange: (a: unknown) => void;
};

export function CodeBlockReviewExercise({ payload, answer, onChange }: Props) {
  const p = payload as Payload | null;
  if (!p) return null;
  const selected = answer as string | null;

  return (
    <div className="space-y-4">
      {/* Code block */}
      <pre className="surface p-4 overflow-x-auto text-xs leading-relaxed">
        <code className="font-mono">{p.code}</code>
      </pre>

      {p.question && (
        <p className="text-sm text-muted-foreground italic">{p.question}</p>
      )}

      <div className="space-y-2">
        {p.options.map((opt, i) => {
          const isSelected = selected === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChange(opt.id)}
              className={cn(
                'group flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all active:scale-[0.99]',
                isSelected
                  ? 'border-primary bg-primary/5 ring-2 ring-primary/30'
                  : 'border-border bg-card hover:bg-secondary/40',
              )}
            >
              <span
                className={cn(
                  'inline-flex size-6 shrink-0 items-center justify-center rounded-md border font-mono text-[10px] font-semibold',
                  isSelected
                    ? 'border-primary bg-primary/15 text-primary'
                    : 'border-border bg-secondary text-muted-foreground',
                )}
              >
                {String.fromCharCode(65 + i)}
              </span>
              <span className="flex-1 text-sm">{opt.text}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
