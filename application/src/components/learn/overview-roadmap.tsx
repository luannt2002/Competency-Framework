/**
 * OverviewRoadmap — read-only showcase view of the full tree, all expanded.
 *
 * Layout (top-down):
 *   [Root hero title]
 *   For each phase: [Phase Pill] + zigzag path of week pills
 *     For each week pill: nested chips of sessions/labs/lessons under it
 *   Renders ALL levels — designed for at-a-glance presentation, no status.
 *
 * Clicks still navigate to /n/[slug] for users who want to drill in.
 */
import Link from 'next/link';
import type { OverviewNode } from '@/lib/tree/queries';

export type RoadmapColor = 'cyan' | 'purple' | 'yellow' | 'green' | 'pink';
const COLORS: RoadmapColor[] = ['cyan', 'purple', 'yellow', 'green', 'pink'];

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

export function OverviewRoadmap({
  phases,
  workspaceSlug,
}: {
  /** Top-level sections to render as phases (cyan/purple/yellow/green/pink rotation). */
  phases: OverviewNode[];
  workspaceSlug: string;
}) {
  if (phases.length === 0) {
    return (
      <p className="text-center text-sm text-muted-foreground">
        Cây học tập trống.
      </p>
    );
  }

  return (
    <div className="rm-roadmap">
      {phases.map((phase, i) => {
        const color = COLORS[i % COLORS.length]!;
        const isLast = i === phases.length - 1;
        const label = TYPE_LABEL[phase.nodeType] ?? phase.nodeType;
        return (
          <div key={phase.id} className="rm-section">
            <div className="rm-phase-label">
              <span>
                {label} {i + 1} / {phases.length}
              </span>
            </div>

            <Link
              href={`/w/${workspaceSlug}/n/${phase.slug}`}
              className={`rm-main-node ${color}`}
            >
              <span aria-hidden>{TYPE_EMOJI[phase.nodeType] ?? '•'}</span>
              <span className="rm-main-title">{phase.title}</span>
              {phase.children.length > 0 && (
                <span
                  className="text-[11px] font-mono opacity-80 tabular-nums px-2 py-0.5 rounded-md ml-1"
                  style={{ background: 'rgba(0,0,0,0.06)' }}
                >
                  {phase.children.length} mục
                </span>
              )}
            </Link>

            {phase.children.length > 0 && (
              <OverviewPath items={phase.children} color={color} workspaceSlug={workspaceSlug} />
            )}

            {!isLast && <div className="rm-connector" />}
          </div>
        );
      })}
    </div>
  );
}

/** Zigzag of week circles, with each week's own children rendered as small chips beside it. */
function OverviewPath({
  items,
  color,
  workspaceSlug,
}: {
  items: OverviewNode[];
  color: RoadmapColor;
  workspaceSlug: string;
}) {
  return (
    <div className="rm-overview-path">
      <svg className="rm-path-svg" preserveAspectRatio="none" viewBox="0 0 100 100">
        <path
          d={buildPathD(items.length)}
          fill="none"
          stroke="currentColor"
          strokeWidth="0.6"
          strokeDasharray="1.5 1.8"
          strokeLinecap="round"
          style={{ color: `var(--rm-${color})`, opacity: 0.5 }}
        />
      </svg>

      <div className="rm-path-list">
        {items.map((wk, i) => {
          const side = i % 2 === 0 ? 'left' : 'right';
          const emoji = TYPE_EMOJI[wk.nodeType] ?? '•';
          return (
            <div key={wk.id} className={`rm-path-item ${side}`}>
              <Link
                href={`/w/${workspaceSlug}/n/${wk.slug}`}
                className={`rm-circle ${color}`}
                title={wk.title}
                aria-label={wk.title}
              >
                <span>{emoji}</span>
              </Link>

              <div className="rm-path-meta">
                <Link href={`/w/${workspaceSlug}/n/${wk.slug}`} className={`rm-path-meta-card block ${color}`}>
                  <div className="rm-path-title">{wk.title}</div>
                  <div className="rm-path-sub">
                    {(TYPE_LABEL[wk.nodeType] ?? wk.nodeType)} · #{i + 1}
                    {wk.children.length > 0 && (
                      <> · {wk.children.length} mục bên trong</>
                    )}
                    {wk.estMinutes ? <> · ~{wk.estMinutes}p</> : null}
                  </div>
                </Link>

                {/* Nested chips: sessions / lessons / labs inside this week */}
                {wk.children.length > 0 && (
                  <div className={`rm-overview-chip-row ${side}`}>
                    {wk.children.map((child) => (
                      <OverviewChipBranch
                        key={child.id}
                        node={child}
                        color={color}
                        workspaceSlug={workspaceSlug}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Recursive chip: a node + its descendants as smaller indented chips. */
function OverviewChipBranch({
  node,
  color,
  workspaceSlug,
}: {
  node: OverviewNode;
  color: RoadmapColor;
  workspaceSlug: string;
}) {
  const emoji = TYPE_EMOJI[node.nodeType] ?? '•';
  const label = TYPE_LABEL[node.nodeType] ?? node.nodeType;
  return (
    <div className="rm-overview-chip-branch">
      <Link
        href={`/w/${workspaceSlug}/n/${node.slug}`}
        className={`rm-overview-chip ${color}`}
        title={`${label}: ${node.title}`}
      >
        <span aria-hidden>{emoji}</span>
        <span className="truncate">{node.title}</span>
      </Link>
      {node.children.length > 0 && (
        <div className="rm-overview-chip-children">
          {node.children.map((c) => (
            <OverviewChipBranch
              key={c.id}
              node={c}
              color={color}
              workspaceSlug={workspaceSlug}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** Reuse the cubic-Bézier zigzag generator. */
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
      const prevX = (i - 1) % 2 === 0 ? xLeft : xRight;
      const prevY = yPad + (i - 1) * step;
      const midY = (prevY + y) / 2;
      parts.push(`C ${prevX} ${midY}, ${x} ${midY}, ${x} ${y}`);
    }
  }
  return parts.join(' ');
}
