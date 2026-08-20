/**
 * SiblingNav — prev/next pagination footer at the bottom of a node detail page.
 *
 * v2: proper footer bar — large tap targets (min-h-14, 44px+ on mobile), a
 * centered position indicator "3/12" with a mini progress bar, and Vietnamese
 * labels. Disabled boundaries render as non-link `<div>` so the layout stays
 * balanced.
 *
 * `linkBase` is "/w/[slug]/n" in learn mode or "/share/[slug]/n" in share.
 */
import Link from 'next/link';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

type Sibling = { slug: string; title: string } | null;

export function SiblingNav({
  prev,
  next,
  linkBase,
  position = null,
  total = 0,
}: {
  prev: Sibling;
  next: Sibling;
  linkBase: string;
  /** 1-based position among siblings (null at a root node). */
  position?: number | null;
  total?: number;
}) {
  if (!prev && !next) return null;

  const pct = position && total > 0 ? Math.round((position / total) * 100) : 0;

  return (
    <nav
      aria-label="Điều hướng giữa các mục"
      className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-2 sm:gap-3 pt-4"
    >
      <SiblingButton sibling={prev} linkBase={linkBase} direction="prev" />
      <div className="flex flex-col items-center justify-center min-w-16 px-2 text-center">
        {position !== null && total > 0 ? (
          <>
            <span className="text-xs font-semibold tabular-nums text-foreground">
              {position}
              <span className="text-muted-foreground">/{total}</span>
            </span>
            <div className="mt-1.5 h-1 w-14 rounded-full bg-secondary overflow-hidden">
              <div className="progress-brand h-full" style={{ width: `${Math.max(4, pct)}%` }} />
            </div>
          </>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </div>
      <SiblingButton sibling={next} linkBase={linkBase} direction="next" />
    </nav>
  );
}

function SiblingButton({
  sibling,
  linkBase,
  direction,
}: {
  sibling: Sibling;
  linkBase: string;
  direction: 'prev' | 'next';
}) {
  const isPrev = direction === 'prev';
  const label = isPrev ? 'Mục trước' : 'Mục tiếp theo';
  const baseCls = cn(
    'surface p-4 min-h-14 flex items-center gap-3 transition-all',
    isPrev ? 'text-left' : 'text-right justify-end',
  );

  if (!sibling) {
    return (
      <div
        className={cn(baseCls, 'opacity-40 cursor-not-allowed')}
        aria-disabled="true"
      >
        {isPrev && <ArrowLeft className="size-4 text-muted-foreground shrink-0" />}
        <div className={cn('min-w-0 flex-1')}>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            {label}
          </div>
          <div className="text-sm text-muted-foreground italic mt-0.5">Đầu danh sách</div>
        </div>
        {!isPrev && <ArrowRight className="size-4 text-muted-foreground shrink-0" />}
      </div>
    );
  }

  return (
    <Link
      href={`${linkBase}/${sibling.slug}`}
      className={cn(baseCls, 'hover:border-primary/40 hover:bg-secondary/40 group')}
    >
      {isPrev && (
        <ArrowLeft className="size-4 text-muted-foreground shrink-0 group-hover:text-foreground transition-colors" />
      )}
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
          {label}
        </div>
        <div className="text-sm font-medium truncate mt-0.5 text-foreground">
          {sibling.title}
        </div>
      </div>
      {!isPrev && (
        <ArrowRight className="size-4 text-muted-foreground shrink-0 group-hover:text-foreground transition-colors" />
      )}
    </Link>
  );
}
