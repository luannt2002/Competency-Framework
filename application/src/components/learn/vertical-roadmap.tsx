/**
 * VerticalRoadmap — server component rendering a top-down "phase pill + sub-row pills"
 * roadmap, inspired by hueanmy.github.io/claude-roadmap.
 *
 * Each section: [Phase Label] → [Main Pill] → [Sub-row of children pills] → connector
 * Colors cycle cyan → purple → yellow → green → pink per section.
 *
 * No client JS needed for the visual — pure CSS + <Link>.
 */
import Link from 'next/link';
import { Check, Circle, Loader2 } from 'lucide-react';
import type { NodeWithStats } from '@/lib/tree/queries';

export type RoadmapColor = 'cyan' | 'purple' | 'yellow' | 'green' | 'pink';
const COLORS: RoadmapColor[] = ['cyan', 'purple', 'yellow', 'green', 'pink'];

/** Vietnamese label for each node type (lowercase). */
const TYPE_LABEL: Record<string, string> = {
  course: 'Khoá học',
  phase: 'Giai đoạn',
  stage: 'Chặng',
  week: 'Tuần',
  session: 'Buổi',
  module: 'Module',
  lesson: 'Bài học',
  theory: 'Lý thuyết',
  lab: 'Lab',
  project: 'Project',
  task: 'Task',
  milestone: 'Cột mốc',
  exam: 'Kiểm tra',
  capstone: 'Capstone',
  custom: 'Tuỳ chỉnh',
};

const TYPE_EMOJI: Record<string, string> = {
  course: '🎓',
  phase: '📚',
  stage: '🪜',
  week: '🗓️',
  session: '🎬',
  module: '🧩',
  lesson: '📖',
  theory: '💡',
  lab: '🧪',
  project: '🛠️',
  task: '✅',
  milestone: '🏁',
  exam: '📝',
  capstone: '🎖️',
  custom: '✨',
};

export type RoadmapSection = {
  main: NodeWithStats;
  subs: NodeWithStats[];
};

export function VerticalRoadmap({
  sections,
  workspaceSlug,
  /** Override color picker per index. Default: cycle COLORS. */
  startColorIndex = 0,
}: {
  sections: RoadmapSection[];
  workspaceSlug: string;
  startColorIndex?: number;
}) {
  if (sections.length === 0) return null;

  return (
    <div className="rm-roadmap">
      {sections.map((sec, i) => {
        const color = COLORS[(i + startColorIndex) % COLORS.length]!;
        const isLast = i === sections.length - 1;
        const label = TYPE_LABEL[sec.main.nodeType] ?? sec.main.nodeType;
        return (
          <div key={sec.main.id} className="rm-section">
            <div className="rm-phase-label">
              <span>
                {label} {i + 1} of {sections.length}
              </span>
            </div>

            <MainPill node={sec.main} color={color} workspaceSlug={workspaceSlug} />

            {sec.subs.length > 0 && (
              <SubRow subs={sec.subs} color={color} workspaceSlug={workspaceSlug} />
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
  workspaceSlug,
}: {
  node: NodeWithStats;
  color: RoadmapColor;
  workspaceSlug: string;
}) {
  const href = `/w/${workspaceSlug}/n/${node.slug}`;
  const isDone = node.status === 'done';
  const pct =
    node.childrenCount > 0
      ? Math.round((node.doneChildren / node.childrenCount) * 100)
      : isDone
        ? 100
        : 0;
  return (
    <Link href={href} className={`rm-main-node ${color}${isDone ? ' done' : ''}`}>
      <span aria-hidden>{TYPE_EMOJI[node.nodeType] ?? '•'}</span>
      <span className="rm-main-title">{node.title}</span>
      {node.childrenCount > 0 && (
        <span
          className="text-[11px] font-mono opacity-80 tabular-nums px-2 py-0.5 rounded-md ml-1"
          style={{ background: 'rgba(255,255,255,0.07)' }}
        >
          {node.doneChildren}/{node.childrenCount} · {pct}%
        </span>
      )}
    </Link>
  );
}

function SubRow({
  subs,
  color,
  workspaceSlug,
}: {
  subs: NodeWithStats[];
  color: RoadmapColor;
  workspaceSlug: string;
}) {
  return (
    <div className="rm-sub-row">
      {subs.map((s) => {
        const href = `/w/${workspaceSlug}/n/${s.slug}`;
        const isDone = s.status === 'done';
        return (
          <Link key={s.id} href={href} className={`rm-sub-node ${color}${isDone ? ' done' : ''}`}>
            {isDone ? (
              <Check className="size-3" />
            ) : s.status === 'in_progress' ? (
              <Loader2 className="size-3" />
            ) : (
              <Circle className="size-3 opacity-50" />
            )}
            <span className="rm-sub-title">{s.title}</span>
            {s.childrenCount > 0 && (
              <span className="text-[10px] opacity-60 tabular-nums">
                ({s.doneChildren}/{s.childrenCount})
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}

/** Gradient hero header (cyan → purple → pink) — matches the roadmap aesthetic. */
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
    <div className="text-center mb-12 md:mb-16" style={{ fontFamily: 'var(--font-outfit), sans-serif' }}>
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
        <p className="text-base md:text-lg text-muted-foreground font-light max-w-2xl mx-auto">{subtitle}</p>
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
