/**
 * NodeCard — large clickable card for a tree node.
 * Used on Dashboard (root nodes) and inside node detail (children).
 *
 * UX principles:
 * - Status indicator (todo / in_progress / done) with color + icon
 * - Progress bar showing % children done (for non-leaf)
 * - Node type chip with semantic icon + color
 * - Click → navigate to /w/[slug]/n/[node-slug]
 * - Hover: subtle lift + accent ring
 */
import Link from 'next/link';
import {
  GraduationCap,
  Layers,
  CalendarRange,
  BookOpen,
  Beaker,
  Hammer,
  Target,
  Trophy,
  ClipboardList,
  Sparkles,
  CheckCircle2,
  Circle,
  PlayCircle,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const TYPE_META: Record<
  string,
  { label: string; icon: typeof GraduationCap; color: string; bg: string; ring: string }
> = {
  course: { label: 'Khoá học', icon: GraduationCap, color: 'text-hue-2', bg: 'bg-hue-2/10', ring: 'ring-hue-2/20' },
  phase: { label: 'Giai đoạn', icon: Layers, color: 'text-hue-1', bg: 'bg-hue-1/10', ring: 'ring-hue-1/20' },
  stage: { label: 'Chặng', icon: Layers, color: 'text-primary', bg: 'bg-primary/10', ring: 'ring-primary/20' },
  week: { label: 'Tuần', icon: CalendarRange, color: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-500/10', ring: 'ring-amber-500/20' },
  session: { label: 'Buổi', icon: ClipboardList, color: 'text-emerald-700 dark:text-emerald-300', bg: 'bg-emerald-500/10', ring: 'ring-emerald-500/20' },
  module: { label: 'Module', icon: Layers, color: 'text-emerald-700 dark:text-emerald-300', bg: 'bg-emerald-500/10', ring: 'ring-emerald-500/20' },
  lesson: { label: 'Bài học', icon: BookOpen, color: 'text-hue-1', bg: 'bg-hue-1/10', ring: 'ring-hue-1/20' },
  theory: { label: 'Lý thuyết', icon: BookOpen, color: 'text-primary', bg: 'bg-primary/10', ring: 'ring-primary/20' },
  lab: { label: 'Lab', icon: Beaker, color: 'text-orange-700 dark:text-orange-300', bg: 'bg-orange-500/10', ring: 'ring-orange-500/20' },
  project: { label: 'Project', icon: Hammer, color: 'text-hue-5', bg: 'bg-hue-5/10', ring: 'ring-hue-5/20' },
  task: { label: 'Task', icon: Target, color: 'text-slate-700 dark:text-slate-300', bg: 'bg-slate-500/10', ring: 'ring-slate-500/20' },
  milestone: { label: 'Cột mốc', icon: Target, color: 'text-amber-700 dark:text-amber-200', bg: 'bg-amber-500/10', ring: 'ring-amber-500/20' },
  exam: { label: 'Kiểm tra', icon: ClipboardList, color: 'text-red-700 dark:text-red-300', bg: 'bg-red-500/10', ring: 'ring-red-500/20' },
  capstone: { label: 'Capstone', icon: Trophy, color: 'text-yellow-700 dark:text-yellow-300', bg: 'bg-yellow-500/10', ring: 'ring-yellow-500/20' },
  custom: { label: 'Tuỳ chỉnh', icon: Sparkles, color: 'text-muted-foreground', bg: 'bg-secondary/40', ring: 'ring-border' },
};

export function typeMeta(t: string) {
  return TYPE_META[t] ?? TYPE_META.custom!;
}

/** All known node types + Vietnamese labels — drives the appearance editor. */
export const NODE_TYPE_LIST: Array<{ nodeType: string; label: string }> = Object.entries(
  TYPE_META,
).map(([nodeType, m]) => ({ nodeType, label: m.label }));

export type NodeCardData = {
  slug: string;
  title: string;
  nodeType: string;
  description: string | null;
  childrenCount: number;
  doneChildren: number;
  status: 'todo' | 'in_progress' | 'done';
  estMinutes: number | null;
  orderIndex: number;
};

export function NodeCard({
  node,
  workspaceSlug,
  size = 'md',
}: {
  node: NodeCardData;
  workspaceSlug: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const meta = typeMeta(node.nodeType);
  const Icon = meta.icon;
  const pct = node.childrenCount === 0 ? 0 : Math.round((node.doneChildren / node.childrenCount) * 100);
  const padding = size === 'lg' ? 'p-6' : size === 'sm' ? 'p-3' : 'p-5';

  return (
    <Link
      href={`/w/${workspaceSlug}/n/${node.slug}`}
      className={cn(
        'group relative block surface transition-all',
        'hover:-translate-y-0.5 hover:ring-2',
        meta.ring,
        node.status === 'done' && 'border-emerald-500/40 bg-emerald-500/5',
        node.status === 'in_progress' && 'border-primary/40 bg-primary/5',
      )}
    >
      <div className={padding}>
        <div className="flex items-start gap-3">
          {/* Type icon */}
          <div className={cn('size-10 rounded-xl flex items-center justify-center shrink-0', meta.bg)}>
            <Icon className={cn('size-5', meta.color)} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={cn('text-[10px] uppercase tracking-wider font-semibold', meta.color)}>
                {meta.label}
              </span>
              <span className="text-[10px] text-muted-foreground tabular-nums">#{node.orderIndex + 1}</span>
              {node.estMinutes ? (
                <span className="text-[10px] text-muted-foreground tabular-nums">· ~{node.estMinutes}m</span>
              ) : null}
              <StatusBadge status={node.status} />
            </div>
            <h3 className={cn(
              'font-semibold truncate',
              size === 'lg' ? 'text-lg' : 'text-sm',
              node.status === 'done' && 'line-through opacity-70',
            )}>
              {node.title}
            </h3>
            {node.description && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{node.description}</p>
            )}
          </div>
          <ChevronRight className="size-4 text-muted-foreground shrink-0 group-hover:text-foreground transition-colors" />
        </div>

        {/* Progress bar */}
        {node.childrenCount > 0 && (
          <div className="mt-4 space-y-1">
            <div className="flex justify-between items-center text-[10px] text-muted-foreground tabular-nums">
              <span>
                {node.doneChildren}/{node.childrenCount} mục con hoàn thành
              </span>
              <span className="font-semibold">{pct}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
              <div
                className={cn(
                  'h-full transition-all duration-500',
                  pct === 100 ? 'bg-gradient-to-r from-emerald-400 to-green-500' : 'accent-gradient',
                )}
                style={{ width: `${Math.max(2, pct)}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </Link>
  );
}

function StatusBadge({ status }: { status: 'todo' | 'in_progress' | 'done' }) {
  if (status === 'done') {
    return (
      <span className="inline-flex items-center gap-0.5 text-[9px] text-emerald-700 dark:text-emerald-400">
        <CheckCircle2 className="size-2.5" />
        Xong
      </span>
    );
  }
  if (status === 'in_progress') {
    return (
      <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-primary">
        <PlayCircle className="size-2.5" />
        Đang làm
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-[9px] text-muted-foreground">
      <Circle className="size-2.5" />
      Chưa làm
    </span>
  );
}
