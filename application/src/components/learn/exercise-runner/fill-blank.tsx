'use client';

import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';

type Blank = { id: number };
type Payload = {
  template: string; // contains "___" placeholders, one per blank in order
  blanks: Blank[];
};

type Props = {
  payload: unknown;
  answer: unknown;
  onChange: (a: unknown) => void;
};

export function FillBlankExercise({ payload, answer, onChange }: Props) {
  const p = payload as Payload | null;
  const [values, setValues] = useState<Record<string, string>>(
    (answer as Record<string, string>) ?? {},
  );

  // Push values up
  useEffect(() => {
    onChange(values);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values]);

  if (!p || !p.template) return null;

  const parts = p.template.split('___');

  return (
    <div className="surface p-5 text-base leading-relaxed">
      {parts.map((part, i) => (
        <span key={i}>
          {part}
          {i < parts.length - 1 && p.blanks[i] && (
            <Input
              type="text"
              className="inline-block mx-1 w-32 h-8 align-baseline"
              value={values[String(p.blanks[i]!.id)] ?? ''}
              onChange={(e) => {
                const bid = String(p.blanks[i]!.id);
                setValues((prev) => ({ ...prev, [bid]: e.target.value }));
              }}
              placeholder="…"
              autoFocus={i === 0}
            />
          )}
        </span>
      ))}
    </div>
  );
}
