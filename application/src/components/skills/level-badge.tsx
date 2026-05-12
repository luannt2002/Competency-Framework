/**
 * LevelBadge — visually distinct chip for a competency level (XS/S/M/L).
 * Used everywhere a skill's level appears.
 */
import { cn } from '@/lib/utils';

const LEVEL_STYLES: Record<string, string> = {
  XS: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30',
  S: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30',
  M: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  L: 'bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30',
};

const LEVEL_LABELS: Record<string, string> = {
  XS: 'Foundational',
  S: 'Working',
  M: 'Strong',
  L: 'Expert',
};

type Props = {
  code?: string | null;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

export function LevelBadge({ code, showLabel = false, size = 'md', className }: Props) {
  if (!code) {
    return (
      <span
        className={cn(
          'inline-flex items-center rounded-full border border-border bg-muted/30 px-2 py-0.5 text-xs font-medium text-muted-foreground',
          className,
        )}
      >
        —
      </span>
    );
  }

  const style = LEVEL_STYLES[code] ?? LEVEL_STYLES.XS;
  const label = LEVEL_LABELS[code];
  const sizeCls = size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : size === 'lg' ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-xs';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-semibold tracking-wide',
        style,
        sizeCls,
        className,
      )}
      title={label}
    >
      <span className="font-mono">{code}</span>
      {showLabel && label && <span className="font-normal opacity-80">· {label}</span>}
    </span>
  );
}
