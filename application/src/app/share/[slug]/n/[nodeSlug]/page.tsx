/**
 * Node detail page (SHARE mode) — public, no auth.
 * Same visual shell as the learn variant but without any actions or status.
 *
 * Reuses: NodeBreadcrumb, NodeHeader (readOnly), VerticalRoadmap (readOnly).
 * Provides a CTA at the bottom to log in and start learning.
 */
import { notFound } from 'next/navigation';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { workspaces } from '@/lib/db/schema';
import { getNodeBySlug, getTreeSections, getSiblings } from '@/lib/tree/queries';
import { NodeBreadcrumb, NodeHeader } from '@/components/learn/node-header';
import { VerticalRoadmap } from '@/components/learn/vertical-roadmap';
import { ShareLinkButton } from '@/components/learn/share-link-button';
import { SiblingNav } from '@/components/learn/sibling-nav';
import { JournalSection } from '@/components/learn/journal-section';
import { ArrowLeft, LogIn } from 'lucide-react';

export default async function ShareNodePage({
  params,
}: {
  params: Promise<{ slug: string; nodeSlug: string }>;
}) {
  const { slug, nodeSlug } = await params;
  const wsRow = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.slug, slug))
    .limit(1);
  const ws = wsRow[0];
  if (!ws) notFound();

  // Read-only: pass null userId — queries skip progress joins.
  const result = await getNodeBySlug(ws.id, null, nodeSlug);
  if (!result) notFound();
  const { node, children, ancestors } = result;

  const sections = children.length > 0 ? await getTreeSections(ws.id, null, node.id) : [];

  // Prev/next sibling navigation — only when this node has a parent.
  const siblings =
    ancestors.length > 0
      ? await getSiblings(ws.id, node.id, node.parentId, node.orderIndex)
      : { prev: null, next: null };

  return (
    <div
      className="mx-auto max-w-5xl p-6 md:p-8 space-y-6"
      style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between text-xs">
        <Link
          href={`/share/${slug}`}
          className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          Quay về roadmap
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground font-mono">👀 Chế độ chia sẻ</span>
          <ShareLinkButton />
        </div>
      </div>

      <NodeBreadcrumb
        ancestors={ancestors}
        current={{ title: node.title }}
        rootHref={`/share/${slug}`}
        rootLabel="Roadmap"
        nodeBase={`/share/${slug}/n`}
      />

      <NodeHeader node={node} readOnly />

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

      {children.length > 0 && (
        <section className="pt-4">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold">
              Lộ trình bên trong ({node.childrenCount})
            </h2>
          </div>

          <VerticalRoadmap
            sections={sections}
            workspaceSlug={slug}
            linkBase={`/share/${slug}/n`}
            readOnly
          />
        </section>
      )}

      {ancestors.length > 0 && (
        <SiblingNav
          prev={siblings.prev}
          next={siblings.next}
          linkBase={`/share/${slug}/n`}
        />
      )}

      <JournalSection
        workspaceId={ws.id}
        workspaceSlug={slug}
        nodeId={node.id}
        readOnly
      />

      {/* Login CTA */}
      <section className="surface p-6 text-center bg-gradient-to-br from-cyan-50 via-violet-50 to-pink-50 dark:from-cyan-950/30 dark:via-violet-950/30 dark:to-pink-950/30">
        <h3 className="text-lg font-bold mb-2">Muốn học và lưu tiến độ?</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Đăng nhập để mở khoá: đánh dấu xong, thêm note, theo dõi streak, XP.
        </p>
        <Link
          href={`/sign-in?next=/w/${slug}/n/${nodeSlug}`}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-foreground text-background text-sm font-semibold hover:opacity-90"
        >
          <LogIn className="size-4" />
          Đăng nhập để học
        </Link>
      </section>
    </div>
  );
}
