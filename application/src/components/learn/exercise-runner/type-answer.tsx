'use client';

import { Input } from '@/components/ui/input';

type Payload = { hint?: string };

type Props = {
  payload: unknown;
  answer: unknown;
  onChange: (a: unknown) => void;
};

export function TypeAnswerExercise({ payload, answer, onChange }: Props) {
  const p = payload as Payload | null;
  return (
    <div className="space-y-2">
      <Input
        type="text"
        value={(answer as string) ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={p?.hint ?? 'Type your answer...'}
        className="h-12 text-base font-mono"
        autoFocus
      />
      {p?.hint && <p className="text-xs text-muted-foreground">Hint: {p.hint}</p>}
    </div>
  );
}
