/**
 * NumberedSection — bold mono numeric prefix + section title (Outfit caps).
 *
 * Renders a "01 — KHÁM PHÁ" header with a gradient number, uppercase tracked
 * title, optional right-aligned subtitle and a subtle border underneath.
 * Matches the rhythmic numbered-section pattern from hueanmy.github.io.
 *
 * @example
 *   <NumberedSection index={1} title="Khám phá" />
 *   <NumberedSection index={2} title="Tính năng" subtitle="3 trọng tâm" />
 */
import * as React from 'react';
import { cn } from '@/lib/utils';

export interface NumberedSectionProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /** 1-based index — rendered as `01`, `02`, … */
  index: number;
  /** Section title (will be displayed uppercase via tracking). */
  title: string;
  /** Optional right-aligned subtitle / count. */
  subtitle?: string;
}

export function NumberedSection({
  index,
  title,
  subtitle,
  className,
  ...rest
}: NumberedSectionProps) {
  const padded = String(index).padStart(2, '0');
  return (
    <div
      className={cn(
        'flex items-end justify-between gap-4 pb-3 mb-6 border-b border-border',
        className,
      )}
      {...rest}
    >
      <div className="flex items-baseline gap-3 md:gap-4 min-w-0">
        <span
          aria-hidden="true"
          className="bg-clip-text text-transparent bg-gradient-to-br from-cyan-400 via-violet-500 to-pink-500 text-2xl md:text-3xl font-bold leading-none tabular-nums"
          style={{ fontFamily: 'var(--font-jetbrains), JetBrains Mono, monospace' }}
        >
          {padded}
        </span>
        <span aria-hidden="true" className="text-muted-foreground/60 select-none">
          —
        </span>
        <h2
          className="text-xs md:text-sm font-semibold uppercase tracking-[0.16em] text-foreground truncate"
          style={{ fontFamily: 'var(--font-outfit), Outfit, sans-serif' }}
        >
          {title}
        </h2>
      </div>
      {subtitle ? (
        <span
          className="hidden md:inline-block text-[0.7rem] font-mono uppercase tracking-wider text-muted-foreground shrink-0"
          style={{ fontFamily: 'var(--font-jetbrains), JetBrains Mono, monospace' }}
        >
          {subtitle}
        </span>
      ) : null}
    </div>
  );
}
