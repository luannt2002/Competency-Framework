/**
 * VerticalRoadmap — Duolingo-style learning path with tree-tree structure.
 *
 * Layout per section:
 *   [Phase Label (monospace)]
 *       [ Big colored pill — main node ]
 *           SVG dashed path winding down
 *               (○) ─── Child 1            (left)
 *                       Child 2 ─── (○)    (right)
 *                  (○) ─── Child 3         (left)
 *                              ...
 *           [👑 Crown] when section is done
 *   ─────── connector ───────
 *   [Next section]
 *
 * Colors rotate cyan → purple → yellow → green → pink per section.
 * Light-theme tuned (pastel bg + saturated border/text + 3D drop shadow).
 */
import Link from 'next/link';
import { Check, Lock } from 'lucide-react';
import type { NodeWithStats } from '@/lib/tree/queries';
import {
  type RoadmapColor,
  ROADMAP_COLORS,
  nodeTypeLabel,
  nodeTypeEmoji,
} from '@/lib/tree/node-meta';

export type { RoadmapColor };

export type RoadmapSection = {
  main: NodeWithStats;
  subs: NodeWithStats[];
};

/** Resolve `/n/<slug>` against the given base. */
function nodeHref(linkBase: string, slug: string): string {
  return `${linkBase.replace(/\/$/, '')}/${slug}`;
}

export function VerticalRoadmap({
  sections,
  workspaceSlug,
  startColorIndex = 0,
  readOnly = false,
  /** Base path used to construct each node's link.
   *  Defaults to `/w/<slug>/n` (learn mode). Pass `/share/<slug>/n` for the
   *  public showcase variant. Trailing slash is normalized. */
  linkBase,
}: {
  sections: RoadmapSection[];
  workspaceSlug: string;
  startColorIndex?: number;
  /** When true: hide status-dependent UI (pulse, lock, crown, done check). */
  readOnly?: boolean;
  linkBase?: string;
}) {
  if (sections.length === 0) return null;
  const resolvedBase = linkBase ?? `/w/${workspaceSlug}/n`;

  return (
    <div className="rm-roadmap">
      {sections.map((sec, i) => {
        const color = ROADMAP_COLORS[(i + startColorIndex) % ROADMAP_COLORS.length]!;
        const isLast = i === sections.length - 1;
        const label = nodeTypeLabel(sec.main.nodeType);
        const sectionDone =
          !readOnly &&
          (sec.main.status === 'done' ||
            (sec.subs.length > 0 && sec.subs.every((s) => s.status === 'done')));

        return (
          <div key={sec.main.id} className="rm-section">
            <div className="rm-phase-label">
              <span>
                {label} {i + 1} / {sections.length}
              </span>
            </div>

            <MainPill node={sec.main} color={color} linkBase={resolvedBase} readOnly={readOnly} />

            {sec.subs.length > 0 && (
              <DuolingoPath subs={sec.subs} color={color} linkBase={resolvedBase} readOnly={readOnly} />
            )}

            {sec.subs.length > 0 && !readOnly && (
              <div className={`rm-crown${sectionDone ? '' : ' locked'}`} aria-hidden>
                {sectionDone ? '👑' : '🔒'}
              </div>
            )}

            {!isLast && <div className="rm-connector" />}
          </div>
        );
      })}
    </div>
  );
}

function MainPill({
  node,
  color,
  linkBase,
  readOnly,
}: {
  node: NodeWithStats;
  color: RoadmapColor;
  linkBase: string;
  readOnly?: boolean;
}) {
  const href = nodeHref(linkBase, node.slug);
  const isDone = !readOnly && node.status === 'done';
  const pct =
    node.childrenCount > 0
      ? Math.round((node.doneChildren / node.childrenCount) * 100)
      : isDone
        ? 100
        : 0;
  return (
    <Link href={href} className={`rm-main-node ${color}${isDone ? ' done' : ''}`}>
      <span aria-hidden>{nodeTypeEmoji(node.nodeType)}</span>
      <span className="rm-main-title">{node.title}</span>
      {!readOnly && node.childrenCount > 0 && (
        <span
          className="text-[11px] font-mono opacity-80 tabular-nums px-2 py-0.5 rounded-md ml-1"
          style={{ background: 'rgba(0,0,0,0.06)' }}
        >
          {node.doneChildren}/{node.childrenCount} · {pct}%
        </span>
      )}
      {readOnly && node.childrenCount > 0 && (
        <span
          className="text-[11px] font-mono opacity-80 tabular-nums px-2 py-0.5 rounded-md ml-1"
          style={{ background: 'rgba(0,0,0,0.06)' }}
        >
          {node.childrenCount} mục
        </span>
      )}
    </Link>
  );
}

/** Duolingo-style zigzag path of round circle nodes. */
function DuolingoPath({
  subs,
  color,
  linkBase,
  readOnly,
}: {
  subs: NodeWithStats[];
  color: RoadmapColor;
  linkBase: string;
  readOnly?: boolean;
}) {
  // In learn mode: find first non-done as "current" (pulse).
  // In read-only mode: no current, no locked.
  const firstUndoneIdx = readOnly ? -1 : subs.findIndex((s) => s.status !== 'done');

  return (
    <div className="rm-path">
      <svg className="rm-path-svg" preserveAspectRatio="none" viewBox="0 0 100 100">
        <path
          d={buildPathD(subs.length)}
          fill="none"
          stroke="currentColor"
          strokeWidth="0.6"
          strokeDasharray="1.5 1.8"
          strokeLinecap="round"
          style={{ color: `var(--rm-${color})`, opacity: 0.5 }}
        />
      </svg>

      <div className="rm-path-list">
        {subs.map((s, i) => {
          const side = i % 2 === 0 ? 'left' : 'right';
          const isDone = !readOnly && s.status === 'done';
          const isCurrent = i === firstUndoneIdx;
          const isLocked = !readOnly && firstUndoneIdx >= 0 && i > firstUndoneIdx + 2;
          const href = nodeHref(linkBase, s.slug);
          const emoji = nodeTypeEmoji(s.nodeType);
          const idxBadge = `${i + 1}`;
          return (
            <div
              key={s.id}
              className={`rm-path-item ${side}${isDone ? ' done' : ''}`}
            >
              <Link
                href={href}
                className={`rm-circle ${color}${isDone ? ' done' : ''}${isCurrent ? ' current' : ''}${isLocked ? ' locked' : ''}`}
                title={s.title}
                aria-label={s.title}
              >
                {isDone ? (
                  <Check className="size-7" strokeWidth={3} />
                ) : isLocked ? (
                  <Lock className="size-5" />
                ) : (
                  <span>{emoji}</span>
                )}
              </Link>

              <div className="rm-path-meta">
                <Link href={href} className={`rm-path-meta-card block ${color}`}>
                  <div className="rm-path-title">{s.title}</div>
                  <div className="rm-path-sub">
                    {nodeTypeLabel(s.nodeType)} · #{idxBadge}
                    {!readOnly && s.childrenCount > 0 && (
                      <> · {s.doneChildren}/{s.childrenCount}</>
                    )}
                    {readOnly && s.childrenCount > 0 && <> · {s.childrenCount} mục</>}
                    {s.estMinutes ? <> · ~{s.estMinutes}p</> : null}
                  </div>
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Build a smooth SVG dashed path that zigzags through `n` items in a 100×100 viewBox.
 * Items alternate between x=12 (left) and x=88 (right) with even Y spacing.
 */
function buildPathD(n: number): string {
  if (n <= 1) return '';
  const xLeft = 14;
  const xRight = 86;
  const yPad = 8;
  const yEnd = 100 - yPad;
  const step = (yEnd - yPad) / (n - 1);
  const parts: string[] = [];
  for (let i = 0; i < n; i++) {
    const x = i % 2 === 0 ? xLeft : xRight;
    const y = yPad + i * step;
    if (i === 0) {
      parts.push(`M ${x} ${y}`);
    } else {
      // Cubic Bézier — control points pull the curve through the midline
      const prevX = (i - 1) % 2 === 0 ? xLeft : xRight;
      const prevY = yPad + (i - 1) * step;
      const midY = (prevY + y) / 2;
      parts.push(`C ${prevX} ${midY}, ${x} ${midY}, ${x} ${y}`);
    }
  }
  return parts.join(' ');
}

/** Gradient hero header (cyan → purple → pink). */
export function RoadmapHero({
  badge,
  title,
  subtitle,
}: {
  badge?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div
      className="text-center mb-12 md:mb-16"
      style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
    >
      {badge && (
        <div
          className="inline-block text-[11px] tracking-[2px] uppercase px-3 py-1 rounded-full mb-5"
          style={{
            fontFamily: 'var(--font-jetbrains), monospace',
            color: 'var(--rm-cyan)',
            border: '1px solid var(--rm-cyan)',
          }}
        >
          {badge}
        </div>
      )}
      <h1
        className="text-4xl md:text-6xl font-extrabold leading-[1.1] mb-4 rm-section-header"
        style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
      >
        {title}
      </h1>
      {subtitle && (
        <p className="text-base md:text-lg text-muted-foreground font-light max-w-2xl mx-auto">
          {subtitle}
        </p>
      )}
    </div>
  );
}

/** Static legend (cyan/purple/yellow/green/pink dots). */
export function RoadmapLegend() {
  return (
    <div
      className="mt-20 mx-auto flex flex-wrap gap-4 justify-center p-6 border rounded-xl"
      style={{
        borderColor: 'hsl(var(--border))',
        background: 'hsl(var(--card))',
        maxWidth: '720px',
        fontFamily: 'var(--font-outfit), sans-serif',
      }}
    >
      {(
        [
          { c: 'var(--rm-cyan)', label: 'Cyan · Phase 1' },
          { c: 'var(--rm-purple)', label: 'Purple · Phase 2' },
          { c: 'var(--rm-yellow)', label: 'Yellow · Phase 3' },
          { c: 'var(--rm-green)', label: 'Green · Phase 4' },
          { c: 'var(--rm-pink)', label: 'Pink · Bonus' },
        ] as const
      ).map((it) => (
        <div key={it.label} className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="size-2.5 rounded-full inline-block" style={{ background: it.c }} />
          {it.label}
        </div>
      ))}
    </div>
  );
}
