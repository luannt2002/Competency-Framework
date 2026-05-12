/**
 * Node detail page — recursive drill-down view.
 * Shows: breadcrumb, node header with status + toolbar, body (md), children as cards.
 * If node has children: it's a folder-like view (children listed as NodeCard).
 * If leaf: body content is the focus + action toolbar.
 *
 * Tree-first navigation: every link inside stays within /w/[slug]/n/[slug]
 * — no global tabs needed.
 */
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, Clock } from 'lucide-react';
import { requireWorkspaceAccess } from '@/lib/workspace';
import { requireUser } from '@/lib/auth/supabase-server';
import { getNodeBySlug } from '@/lib/tree/queries';
import { NodeCard } from '@/components/learn/node-card';
import { typeMeta } from '@/components/learn/node-card';
import { NodeToolbar } from '@/components/learn/node-toolbar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export default async function NodeDetailPage({
  params,
}: {
  params: Promise<{ slug: string; nodeSlug: string }>;
}) {
  const { slug, nodeSlug } = await params;
  const ws = await requireWorkspaceAccess(slug);
  const user = await requireUser();

  const result = await getNodeBySlug(ws.id, user.id, nodeSlug);
  if (!result) notFound();
  const { node, children, ancestors } = result;
  const meta = typeMeta(node.nodeType);
  const Icon = meta.icon;
  const parentSlug = ancestors.length > 0 ? ancestors[ancestors.length - 1]!.slug : null;

  return (
    <div className="mx-auto max-w-5xl p-6 md:p-8 space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center flex-wrap gap-1 text-xs text-muted-foreground">
        <Link href={`/w/${slug}`} className="hover:text-foreground hover:underline">
          🏠 Cây học tập
        </Link>
        {ancestors.map((a) => (
          <span key={a.id} className="inline-flex items-center gap-1">
            <ChevronRight className="size-3" />
            <Link href={`/w/${slug}/n/${a.slug}`} className="hover:text-foreground hover:underline truncate max-w-[200px]">
              {a.title}
            </Link>
          </span>
        ))}
        <ChevronRight className="size-3" />
        <span className="text-foreground font-medium truncate max-w-[200px]">{node.title}</span>
      </nav>

      {/* Header */}
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
                  ? `${node.doneChildren}/${node.childrenCount} con đã xong`
                  : 'Lá (không có con)'}
              </span>
              {node.status === 'done' && (
                <Badge variant="success" className="text-[10px]">
                  ✓ Đã xong
                </Badge>
              )}
            </div>
            <h1 className={cn('text-2xl md:text-3xl font-bold tracking-tight', node.status === 'done' && 'line-through opacity-70')}>
              {node.title}
            </h1>
            {node.description && (
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{node.description}</p>
            )}
          </div>
        </div>

        {/* Progress bar */}
        {node.childrenCount > 0 && (
          <div>
            <div className="flex justify-between text-[11px] text-muted-foreground tabular-nums mb-1">
              <span>Tiến độ con</span>
              <span className="font-semibold">
                {Math.round((node.doneChildren / node.childrenCount) * 100)}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-secondary overflow-hidden">
              <div
                className={cn(
                  'h-full transition-all duration-500',
                  node.doneChildren === node.childrenCount
                    ? 'bg-gradient-to-r from-emerald-400 to-green-500'
                    : 'accent-gradient',
                )}
                style={{
                  width: `${Math.max(2, Math.round((node.doneChildren / node.childrenCount) * 100))}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Action toolbar */}
        <NodeToolbar
          workspaceSlug={slug}
          node={{
            id: node.id,
            title: node.title,
            nodeType: node.nodeType,
            description: node.description,
            bodyMd: node.bodyMd,
            estMinutes: node.estMinutes,
            status: node.status,
            childrenCount: node.childrenCount,
            parentSlug,
          }}
        />
      </header>

      {/* Body (markdown raw — simple <pre> for now, can wire react-markdown later) */}
      {node.bodyMd && (
        <section className="surface p-6">
          <h2 className="text-sm uppercase tracking-wider text-muted-foreground font-semibold mb-3">
            Nội dung chi tiết
          </h2>
          <div className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap text-sm leading-relaxed">
            {node.bodyMd}
          </div>
        </section>
      )}

      {/* Children section */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {node.childrenCount === 0 ? 'Chưa có con' : `Lộ trình bên trong (${node.childrenCount})`}
          </h2>
          {node.childrenCount > 0 && (
            <span className="text-xs text-muted-foreground">
              {node.doneChildren}/{node.childrenCount} đã xong
            </span>
          )}
        </div>

        {children.length === 0 ? (
          <div className="surface p-8 text-center text-sm text-muted-foreground border-dashed border-cyan-500/30 bg-cyan-500/5">
            <p className="mb-3">
              Chưa có node con trong "{node.title}". Click "Thêm con" ở trên để bắt đầu.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {children.map((child) => (
              <NodeCard key={child.id} node={child} workspaceSlug={slug} size="md" />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
