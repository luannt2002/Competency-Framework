/**
 * Public share page — read-only overview of a workspace's roadmap tree.
 * No auth required. No status, no progress, no CRUD — pure showcase.
 *
 * Designed for: sending the link to colleagues / posting to social.
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { workspaces } from '@/lib/db/schema';
import { getFullTree } from '@/lib/tree/queries';
import { OverviewRoadmap } from '@/components/learn/overview-roadmap';
import { RoadmapHero, RoadmapLegend } from '@/components/learn/vertical-roadmap';
import { ShareLinkButton } from '@/components/learn/share-link-button';
import { ArrowLeft } from 'lucide-react';

export default async function SharePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const wsRow = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.slug, slug))
    .limit(1);
  const ws = wsRow[0];
  if (!ws) notFound();

  const rootNodes = await getFullTree(ws.id);

  // If there's exactly 1 root (typical seed), use its title as hero + render its
  // children as phases. Otherwise treat each root as a phase.
  let heroTitle = ws.name;
  let heroSubtitle: string | undefined;
  let phases = rootNodes;
  if (rootNodes.length === 1) {
    const root = rootNodes[0]!;
    heroTitle = root.title;
    heroSubtitle = root.description ?? undefined;
    phases = root.children;
  }

  // Total counts (flatten the tree)
  let totalNodes = 0;
  const walk = (nodes: typeof rootNodes) => {
    for (const n of nodes) {
      totalNodes++;
      walk(n.children);
    }
  };
  walk(rootNodes);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 md:py-16" style={{ fontFamily: 'var(--font-outfit), sans-serif' }}>
      {/* Top bar */}
      <div className="flex items-center justify-between mb-8 text-xs">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          Trang chủ
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground font-mono">
            👀 Chế độ xem · {totalNodes} mục
          </span>
          <ShareLinkButton />
        </div>
      </div>

      <RoadmapHero
        badge="Roadmap · Read-only"
        title={heroTitle}
        subtitle={heroSubtitle ?? 'Lộ trình học tập — xem nhanh toàn bộ cấu trúc cây.'}
      />

      <OverviewRoadmap phases={phases} workspaceSlug={slug} />

      <RoadmapLegend />

      <div className="mt-10 text-center text-xs text-muted-foreground">
        <p>
          Đây là trang chia sẻ chỉ xem. Để học và tự theo dõi tiến độ:{' '}
          <Link href={`/w/${slug}`} className="underline hover:text-foreground">
            mở trang học
          </Link>
        </p>
      </div>
    </div>
  );
}
