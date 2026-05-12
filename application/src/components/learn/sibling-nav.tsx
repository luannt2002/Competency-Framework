/**
 * SiblingNav — prev/next pagination at the bottom of a node detail page.
 *
 * Server component (no client state needed). Both buttons render even at the
 * boundary, but disabled buttons render as `<div>` (non-link) with reduced
 * opacity so the layout stays balanced.
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
}: {
  prev: Sibling;
  next: Sibling;
  linkBase: string;
}) {
  if (!prev && !next) return null;

  return (
    <nav
      aria-label="Sibling navigation"
      className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4"
    >
      <SiblingButton sibling={prev} linkBase={linkBase} direction="prev" />
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
  const label = isPrev ? '← Prev sibling' : 'Next sibling →';
  const align = isPrev ? 'text-left' : 'text-right sm:order-2';
  const baseCls = cn(
    'surface p-4 flex items-center gap-3 transition-all',
    align,
    isPrev ? '' : 'sm:justify-end',
  );

  if (!sibling) {
    return (
      <div
        className={cn(baseCls, 'opacity-40 cursor-not-allowed')}
        aria-disabled="true"
      >
        {isPrev && <ArrowLeft className="size-4 text-muted-foreground shrink-0" />}
        <div className={cn('min-w-0 flex-1', isPrev ? '' : 'sm:text-right')}>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            {label}
          </div>
          <div className="text-sm text-muted-foreground italic mt-0.5">— hết —</div>
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
      <div className={cn('min-w-0 flex-1', isPrev ? '' : 'sm:text-right')}>
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
