/**
 * Node detail page (LEARN mode) — auth-gated.
 * Shows: breadcrumb, header (with status + progress + toolbar), body (md),
 * children rendered as VerticalRoadmap.
 *
 * Reuses: NodeBreadcrumb, NodeHeader, VerticalRoadmap.
 * Auth: enforced by (app)/layout.tsx → requireUser().
 */
import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { requireWorkspaceAccess } from '@/lib/workspace';
import { requireUser } from '@/lib/auth/supabase-server';
import { getNodeBySlug, getTreeSections, getSiblings } from '@/lib/tree/queries';
import { NodeBreadcrumb, NodeHeader } from '@/components/learn/node-header';
import { NodeToolbar } from '@/components/learn/node-toolbar';
import { VerticalRoadmap } from '@/components/learn/vertical-roadmap';
import { SiblingNav } from '@/components/learn/sibling-nav';
import { JournalSection } from '@/components/learn/journal-section';
import { ResourcesSection } from '@/components/learn/resources-section';

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
  const parentSlug = ancestors.length > 0 ? ancestors[ancestors.length - 1]!.slug : null;

  const sections = children.length > 0 ? await getTreeSections(ws.id, user.id, node.id) : [];

  // Prev/next sibling navigation — only when this node has a parent.
  const siblings =
    ancestors.length > 0
      ? await getSiblings(ws.id, node.id, node.parentId, node.orderIndex)
      : { prev: null, next: null };

  return (
    <div className="mx-auto max-w-5xl p-6 md:p-8 space-y-6">
      <NodeBreadcrumb
        ancestors={ancestors}
        current={{ title: node.title }}
        rootHref={`/w/${slug}`}
        rootLabel="Cây học tập"
        nodeBase={`/w/${slug}/n`}
      />

      <NodeHeader
        node={node}
        actions={
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
        }
      />

      {node.bodyMd && (
        <section className="surface p-6">
          <h2 className="text-sm uppercase tracking-wider text-muted-foreground font-semibold mb-3">
            Nội dung chi tiết
          </h2>
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{node.bodyMd}</ReactMarkdown>
          </div>
        </section>
      )}

      <section className="pt-4">
        <div className="flex items-center justify-between mb-6">
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
              Chưa có node con trong &quot;{node.title}&quot;. Click &quot;Thêm con&quot; ở trên để bắt đầu.
            </p>
          </div>
        ) : (
          <VerticalRoadmap sections={sections} workspaceSlug={slug} />
        )}
      </section>

      {ancestors.length > 0 && (
        <SiblingNav
          prev={siblings.prev}
          next={siblings.next}
          linkBase={`/w/${slug}/n`}
        />
      )}

      <ResourcesSection
        workspaceId={ws.id}
        workspaceSlug={slug}
        nodeId={node.id}
      />

      <JournalSection
        workspaceId={ws.id}
        workspaceSlug={slug}
        nodeId={node.id}
      />
    </div>
  );
}
