'use client';

/**
 * F18 — CrownCount: crown icon + count, tinted by the strongest level_source.
 *
 *   self_claimed → muted (gray) · learned (or "both" = self+learned) → primary
 *   (blue) · verified → yellow (gold). Ranking: verified > learned > self_claimed.
 *
 * Only semantic/state color tokens are used — no raw palette hues.
 */

import { Crown } from 'lucide-react';
import { cn } from '@/lib/utils';

export type CrownSource = 'self_claimed' | 'learned' | 'both' | 'verified' | null | undefined;

/** Tailwind text class for a level_source. Pure — unit-tested. */
export function crownToneClass(source: CrownSource): string {
  if (source === 'verified') return 'text-yellow-500';
  if (source === 'learned' || source === 'both') return 'text-primary';
  return 'text-muted-foreground';
}

export function CrownCount({
  crowns,
  source,
  className,
}: {
  crowns: number | null | undefined;
  source: CrownSource;
  className?: string;
}) {
  const tone = crownToneClass(source);
  return (
    <span
      className={cn('inline-flex items-center gap-1 tabular-nums', tone, className)}
      title={`${crowns ?? 0}/5 crowns · ${source ?? 'unassessed'}`}
    >
      <Crown className="size-3.5" aria-hidden />
      {crowns ?? 0}
      <span className="text-muted-foreground">/5</span>
    </span>
  );
}
