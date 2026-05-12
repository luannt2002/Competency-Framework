/**
 * Empty-state illustrations — minimal monochrome line-art with a coral accent.
 *
 * Each export is a single inline <svg> (no external assets) so they ship as
 * part of the component bundle and can be re-styled via className (default
 * sizing is 96×96; pass `size-32` etc. to scale). The neutral strokes use
 * `currentColor` so they pick up `text-muted-foreground` from a parent; the
 * coral accent (`#cc785c`) is hard-coded to match `--primary`.
 *
 * Design conventions:
 *   - 1.5px stroke, rounded line caps & joins
 *   - Neutral strokes via currentColor; accent via #cc785c
 *   - No fills (or minimally tinted) so they read well on cream paper
 *   - Each illustration is square and centred in a 96×96 viewBox
 */
import * as React from 'react';
import { cn } from '@/lib/utils';

const CORAL = '#cc785c';

type IllProps = {
  /** Additional classes for sizing / colouring the neutral strokes. */
  className?: string;
  /** Accessible label — if omitted the SVG is marked aria-hidden. */
  label?: string;
};

function baseProps(label?: string): React.SVGProps<SVGSVGElement> {
  return {
    viewBox: '0 0 96 96',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    role: label ? 'img' : 'presentation',
    'aria-label': label,
    'aria-hidden': label ? undefined : true,
  };
}

/** Empty-tree sketch — a slender trunk with a few bare branches. */
export function NoWorkspacesIllustration({ className, label }: IllProps) {
  return (
    <svg
      {...baseProps(label)}
      className={cn('size-24 text-muted-foreground', className)}
    >
      {/* Ground line */}
      <path d="M14 80 L82 80" />
      {/* Trunk */}
      <path d="M48 80 L48 38" />
      {/* Left branches */}
      <path d="M48 62 L34 50" />
      <path d="M48 50 L30 36" />
      <path d="M48 44 L36 30" />
      {/* Right branches */}
      <path d="M48 58 L62 46" />
      <path d="M48 46 L66 32" />
      {/* Sparse "buds" (coral accent) */}
      <circle cx="30" cy="36" r="2" fill={CORAL} stroke={CORAL} />
      <circle cx="66" cy="32" r="2" fill={CORAL} stroke={CORAL} />
      <circle cx="48" cy="38" r="2" fill={CORAL} stroke={CORAL} />
      {/* Subtle wind whisp underline (coral) */}
      <path
        d="M22 86 Q40 84 56 86 T82 86"
        stroke={CORAL}
        strokeOpacity="0.5"
        strokeDasharray="2 4"
      />
    </svg>
  );
}

/** Empty card / box — a tilted open box with a question-mark hint inside. */
export function NoNodesIllustration({ className, label }: IllProps) {
  return (
    <svg
      {...baseProps(label)}
      className={cn('size-24 text-muted-foreground', className)}
    >
      {/* Box bottom (rectangle) */}
      <path d="M20 40 L20 76 L76 76 L76 40 Z" />
      {/* Box lid (open, tilted left) */}
      <path d="M20 40 L48 22 L76 40" />
      {/* Lid fold seam */}
      <path d="M20 40 L48 32 L76 40" strokeOpacity="0.55" />
      {/* Inner shadow line */}
      <path d="M20 40 L48 50 L76 40" strokeOpacity="0.35" strokeDasharray="2 3" />
      <path d="M48 50 L48 76" strokeOpacity="0.35" strokeDasharray="2 3" />
      {/* Floating dotted sparkle suggesting "empty / waiting" (coral) */}
      <circle cx="48" cy="14" r="1.5" fill={CORAL} stroke={CORAL} />
      <path
        d="M42 12 L40 8 M54 12 L56 8 M48 6 L48 2"
        stroke={CORAL}
        strokeOpacity="0.6"
      />
    </svg>
  );
}

/** Notebook with a leaf — closed journal with a folded leaf tucked into pages. */
export function NoJournalIllustration({ className, label }: IllProps) {
  return (
    <svg
      {...baseProps(label)}
      className={cn('size-24 text-muted-foreground', className)}
    >
      {/* Notebook body */}
      <path d="M22 18 L70 18 L70 82 L22 82 Z" />
      {/* Spine */}
      <path d="M30 18 L30 82" strokeOpacity="0.55" />
      {/* Lines on the page */}
      <path d="M38 32 L62 32" strokeOpacity="0.4" />
      <path d="M38 40 L62 40" strokeOpacity="0.4" />
      <path d="M38 48 L56 48" strokeOpacity="0.4" />
      <path d="M38 56 L60 56" strokeOpacity="0.4" />
      <path d="M38 64 L52 64" strokeOpacity="0.4" />
      {/* Spiral binding dots */}
      <circle cx="26" cy="26" r="1" />
      <circle cx="26" cy="38" r="1" />
      <circle cx="26" cy="50" r="1" />
      <circle cx="26" cy="62" r="1" />
      <circle cx="26" cy="74" r="1" />
      {/* Bookmark leaf tucked from the top right (coral) */}
      <path d="M64 14 L66 30 L70 26 L74 32 L72 18 Z" stroke={CORAL} />
      <path d="M68 18 L68 28" stroke={CORAL} strokeOpacity="0.7" />
    </svg>
  );
}

/** Bookshelf with an empty slot — three books leaning, one missing on the right. */
export function NoResourcesIllustration({ className, label }: IllProps) {
  return (
    <svg
      {...baseProps(label)}
      className={cn('size-24 text-muted-foreground', className)}
    >
      {/* Shelf */}
      <path d="M14 76 L82 76" strokeWidth="2" />
      <path d="M14 22 L82 22" />
      <path d="M14 22 L14 76" strokeOpacity="0.55" />
      <path d="M82 22 L82 76" strokeOpacity="0.55" />
      {/* Book 1 (upright) */}
      <path d="M22 76 L22 36 L32 36 L32 76" />
      <path d="M22 44 L32 44" strokeOpacity="0.5" />
      {/* Book 2 (slightly taller) */}
      <path d="M34 76 L34 30 L44 30 L44 76" />
      <path d="M34 40 L44 40" strokeOpacity="0.5" />
      {/* Book 3 (leaning right) */}
      <path d="M46 76 L50 36 L60 38 L56 78" />
      {/* Empty slot guide on the right (coral, dashed) */}
      <path
        d="M64 76 L64 40 L74 40 L74 76"
        stroke={CORAL}
        strokeDasharray="3 3"
      />
      {/* Coral "+" hinting where to add */}
      <path d="M65 56 L73 56 M69 52 L69 60" stroke={CORAL} />
    </svg>
  );
}
