/**
 * Landing kit — the single source of layout and spacing decisions for the
 * marketing page.
 *
 * Deliberately adds ZERO css: every visual here is either an existing project
 * utility (`.surface`, `.surface-lift`, `.btn-brand`) or a plain Tailwind
 * semantic token (`bg-primary/10`, `text-muted-foreground`, `border-border`).
 * No hex, no rgb(), nothing appended to globals.css.
 *
 * What this file DOES own is consistency:
 *   - one container width (`SHELL`) — the same one /discover uses,
 *   - one vertical rhythm (`SECTION_Y`, `BAND_Y`),
 *   - one grid gap scale (`GRID_GAP`),
 *   - one card shape (`InfoCard`) reused by steps, features, roles, mechanics.
 * Change a token here and all eight bands move together.
 */
import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FadeInSection } from '@/components/ui/fade-in-section';
import { NumberedSection } from '@/components/ui/numbered-section';

/* ---------------------------------------------------------------- tokens */

/** Container: identical to /discover so the two public pages line up. */
export const SHELL = 'mx-auto w-full max-w-6xl px-5 sm:px-6 lg:px-8';

/** Standard section rhythm — the ONLY vertical padding a section may use. */
export const SECTION_Y = 'py-14 sm:py-20 lg:py-24';

/** Rhythm for the full-bleed tinted bands (hero, closing CTA). */
export const BAND_Y = 'py-16 sm:py-20 lg:py-24';

/** Card grid gap — steps up with the viewport, identical in every grid. */
export const GRID_GAP = 'gap-4 sm:gap-5 lg:gap-6';

/**
 * The icon-tile chrome, matching the pattern the landing already used before
 * this rework (`bg-primary/10` + `text-primary`). Kept as one constant so a
 * feature tile and a badge tile can never drift apart.
 */
export const TILE = 'bg-primary/10 text-primary';

/**
 * One number formatter for the whole page (vi-VN grouping: 1.234) so a count
 * never renders two different ways in two different sections.
 */
export function formatCount(n: number): string {
  return new Intl.NumberFormat('vi-VN').format(n);
}

/* ------------------------------------------------------------ primitives */

export interface AccentTileProps {
  icon: LucideIcon;
  /** `md` (default) for cards, `sm` for dense rows. */
  size?: 'sm' | 'md';
  /** `rounded` (default) for cards, `circle` for badge-style tiles. */
  shape?: 'rounded' | 'circle';
  className?: string;
}

/** Tinted icon frame. Decorative — always paired with a visible text label. */
export function AccentTile({ icon: Icon, size = 'md', shape = 'rounded', className }: AccentTileProps) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center',
        shape === 'circle' ? 'rounded-full' : 'rounded-xl',
        size === 'md' ? 'size-11' : 'size-8',
        TILE,
        className,
      )}
    >
      <Icon className={size === 'md' ? 'size-5' : 'size-4'} aria-hidden="true" />
    </span>
  );
}

export interface LandingSectionProps {
  /** 1-based index rendered as `01`, `02`, … by <NumberedSection>. */
  index: number;
  title: string;
  /** Right-aligned count / label inside the numbered header. */
  subtitle?: string;
  /** Optional lead paragraph under the header. */
  lead?: React.ReactNode;
  /** Stagger for the scroll reveal. */
  delay?: number;
  id?: string;
  className?: string;
  children: React.ReactNode;
}

/**
 * A numbered content band: reveal-on-scroll + shell + rhythm + header.
 * Sections never set their own padding or max-width.
 */
export function LandingSection({
  index,
  title,
  subtitle,
  lead,
  delay,
  id,
  className,
  children,
}: LandingSectionProps) {
  return (
    <FadeInSection delay={delay} className={cn('border-b border-border', className)}>
      <div className={cn(SHELL, SECTION_Y)} id={id}>
        <NumberedSection index={index} title={title} subtitle={subtitle} />
        {lead ? (
          <p className="-mt-2 mb-8 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            {lead}
          </p>
        ) : null}
        {children}
      </div>
    </FadeInSection>
  );
}

export interface InfoCardProps {
  icon: LucideIcon;
  title: string;
  desc: string;
  /** Optional eyebrow beside the icon (step index, role label…). */
  eyebrow?: string;
  /** Oversized numeral watermarked into the top-right corner (steps). */
  watermark?: string;
  /** Optional bullet list rendered under the description. */
  bullets?: readonly string[];
  /** Anything extra pinned to the bottom of the card. */
  footer?: React.ReactNode;
  className?: string;
}

/**
 * The one card shape on this page. Features, steps, roles and the motivation
 * tiles are all this component with different props — that single primitive
 * is the whole consistency story.
 */
export function InfoCard({
  icon,
  title,
  desc,
  eyebrow,
  watermark,
  bullets,
  footer,
  className,
}: InfoCardProps) {
  return (
    <article
      className={cn(
        'surface surface-lift relative flex h-full flex-col overflow-hidden p-5 sm:p-6',
        className,
      )}
    >
      {watermark ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-4 top-1 select-none font-mono text-5xl font-bold leading-none tabular-nums text-primary/10 sm:text-6xl"
        >
          {watermark}
        </span>
      ) : null}
      <div className="mb-4 flex items-center gap-3">
        <AccentTile icon={icon} />
        {eyebrow ? (
          <span className="font-mono text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-primary">
            {eyebrow}
          </span>
        ) : null}
      </div>
      <h3 className="mb-2 text-base font-semibold leading-snug sm:text-lg">{title}</h3>
      <p className="text-sm leading-relaxed text-muted-foreground">{desc}</p>
      {bullets && bullets.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {bullets.map((b) => (
            <li key={b} className="flex items-start gap-2 text-sm text-muted-foreground">
              <span className={cn('mt-0.5 shrink-0 rounded-full p-0.5', TILE)}>
                <Check className="size-3" aria-hidden="true" />
              </span>
              <span className="min-w-0">{b}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {footer ? <div className="mt-auto pt-5">{footer}</div> : null}
    </article>
  );
}

export interface StatTileProps {
  /** Already-formatted value — the caller owns number formatting. */
  value: string;
  label: string;
  icon: LucideIcon;
}

/**
 * Compact metric tile for the hero strip. Renders a real <dt>/<dd> pair so
 * screen readers announce "label: value"; must live inside a <dl>.
 * Values always come from the DB — the caller formats with `formatCount`.
 */
export function StatTile({ value, label, icon }: StatTileProps) {
  return (
    <div className="surface flex items-center gap-3 px-3 py-3 sm:px-4">
      <AccentTile icon={icon} size="sm" />
      <div className="min-w-0 text-left">
        <dd className="font-mono text-lg font-bold leading-none tabular-nums sm:text-xl">
          {value}
        </dd>
        {/* wraps rather than truncates — at 360px "huy hiệu đã định nghĩa"
            does not fit on one line and an ellipsis would hide the meaning */}
        <dt className="mt-1 text-[0.7rem] uppercase leading-tight tracking-wide text-muted-foreground">
          {label}
        </dt>
      </div>
    </div>
  );
}
