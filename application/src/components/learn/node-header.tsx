/**
 * NodeHeader — reusable header card for a tree node detail page.
 *
 * Same visual shell for /w/[slug]/n/[slug] (learn) and /share/[slug]/n/[slug]
 * (share). In read-only mode, status badges + progress bar are hidden.
 */
import Link from 'next/link';
import { ChevronRight, Clock } from 'lucide-react';
import { typeMeta } from '@/components/learn/node-card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { NodeWithStats } from '@/lib/tree/queries';

type Ancestor = { id: string; slug: string; title: string };

export function NodeBreadcrumb({
  ancestors,
  current,
  rootHref,
  rootLabel,
  nodeBase,
}: {
  ancestors: Ancestor[];
  current: { title: string };
  /** href for the root crumb. */
  rootHref: string;
  rootLabel: string;
  /** Base path for ancestor links — `/w/<slug>/n` or `/share/<slug>/n`. */
  nodeBase: string;
}) {
  return (
    <nav className="flex items-center flex-wrap gap-1 text-xs text-muted-foreground">
      <Link href={rootHref} className="hover:text-foreground hover:underline">
        🏠 {rootLabel}
      </Link>
      {ancestors.map((a) => (
        <span key={a.id} className="inline-flex items-center gap-1">
          <ChevronRight className="size-3" />
          <Link
            href={`${nodeBase}/${a.slug}`}
            className="hover:text-foreground hover:underline truncate max-w-[200px]"
          >
            {a.title}
          </Link>
        </span>
      ))}
      <ChevronRight className="size-3" />
      <span className="text-foreground font-medium truncate max-w-[200px]">{current.title}</span>
    </nav>
  );
}

export function NodeHeader({
  node,
  readOnly = false,
  /** Slot for extra action buttons (toolbar) under the header. */
  actions,
}: {
  node: NodeWithStats;
  readOnly?: boolean;
  actions?: React.ReactNode;
}) {
  const meta = typeMeta(node.nodeType);
  const Icon = meta.icon;
  const showStatus = !readOnly;
  const isDone = showStatus && node.status === 'done';
  const pct =
    node.childrenCount > 0
      ? Math.round((node.doneChildren / node.childrenCount) * 100)
      : 0;

  return (
    <header className="surface p-6 space-y-4 relative overflow-hidden">
      {/* Top accent gradient */}
      <div className={cn('absolute inset-x-0 top-0 h-1', meta.bg)} />

      <div className="flex items-start gap-4">
        <div className={cn('size-12 rounded-2xl flex items-center justify-center shrink-0', meta.bg)}>
          <Icon className={cn('size-6', meta.color)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <Badge variant="outline" className={meta.color}>
              {meta.label}
            </Badge>
            {node.estMinutes ? (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="size-3" />
                ~{node.estMinutes}m
              </span>
            ) : null}
            <span className="text-xs text-muted-foreground">
              {node.childrenCount > 0
                ? showStatus
                  ? `${node.doneChildren}/${node.childrenCount} con đã xong`
                  : `${node.childrenCount} mục con`
                : 'Lá (không có con)'}
            </span>
            {isDone && (
              <Badge variant="success" className="text-[10px]">
                ✓ Đã xong
              </Badge>
            )}
          </div>
          <h1
            className={cn(
              'text-2xl md:text-3xl font-bold tracking-tight',
              isDone && 'line-through opacity-70',
            )}
          >
            {node.title}
          </h1>
          {node.description && (
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
              {node.description}
            </p>
          )}
        </div>
      </div>

      {/* Progress bar (learn mode only) */}
      {showStatus && node.childrenCount > 0 && (
        <div>
          <div className="flex justify-between text-[11px] text-muted-foreground tabular-nums mb-1">
            <span>Tiến độ con</span>
            <span className="font-semibold">{pct}%</span>
          </div>
          <div className="h-2 rounded-full bg-secondary overflow-hidden">
            <div
              className={cn(
                'h-full transition-all duration-500',
                node.doneChildren === node.childrenCount
                  ? 'bg-gradient-to-r from-emerald-400 to-green-500'
                  : 'accent-gradient',
              )}
              style={{ width: `${Math.max(2, pct)}%` }}
            />
          </div>
        </div>
      )}

      {actions}
    </header>
  );
}
