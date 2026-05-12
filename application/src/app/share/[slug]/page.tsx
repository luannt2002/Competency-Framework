/**
 * Public share page — read-only snapshot of a workspace's roadmap.
 *
 * SAME visual component as the learn dashboard (VerticalRoadmap with
 * zigzag path + circle nodes), but with `readOnly={true}` so:
 *   - No pulse on current
 *   - No lock / done check
 *   - No crown
 *
 * No auth required. No user-progress data is fetched (passes null userId).
 */
import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { eq, count, isNull, and } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { workspaces, roadmapTreeNodes } from '@/lib/db/schema';
import { getRootNodes, getTreeSections } from '@/lib/tree/queries';
import { VerticalRoadmap, RoadmapHero, RoadmapLegend } from '@/components/learn/vertical-roadmap';
import { StatChip } from '@/components/learn/stat-chip';
import { ShareLinkButton } from '@/components/learn/share-link-button';
import { NumberedSection } from '@/components/ui/numbered-section';
import { FollowButton } from '@/components/social/follow-button';
import { getCurrentUser } from '@/lib/auth/supabase-server';
import { isFollowingWorkspace } from '@/actions/follows';
import { ArrowLeft, Layers, Sparkles } from 'lucide-react';

const SITE_NAME = 'Competency Framework';

function truncate(s: string | null | undefined, max: number): string {
  if (!s) return '';
  const t = s.trim();
  return t.length <= max ? t : t.slice(0, max - 1).trimEnd() + '…';
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const wsRow = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.slug, slug))
    .limit(1);
  const ws = wsRow[0];
  if (!ws) {
    return { title: 'Roadmap not found · ' + SITE_NAME };
  }

  // Count nodes + try to pick description from sole root node (workspaces table has none).
  const [totalNodesRow, rootRow] = await Promise.all([
    db
      .select({ n: count() })
      .from(roadmapTreeNodes)
      .where(eq(roadmapTreeNodes.workspaceId, ws.id)),
    db
      .select({ description: roadmapTreeNodes.description })
      .from(roadmapTreeNodes)
      .where(
        and(
          eq(roadmapTreeNodes.workspaceId, ws.id),
          isNull(roadmapTreeNodes.parentId),
        ),
      )
      .limit(2),
  ]);
  const totalNodes = totalNodesRow[0]?.n ?? 0;
  const rootDescription = rootRow.length === 1 ? rootRow[0]?.description ?? null : null;

  const title = `${ws.name} · Roadmap`;
  const description =
    truncate(rootDescription, 160) || `Lộ trình học tập — ${totalNodes} mục`;
  const ogImage = `/api/og?slug=${encodeURIComponent(slug)}`;
  const url = `/share/${slug}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      type: 'website',
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
  };
}

export default async function SharePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const wsRow = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.slug, slug))
    .limit(1);
  const ws = wsRow[0];
  if (!ws) notFound();

  // Read-only: pass null userId — queries skip progress joins.
  const [rootNodes, totalNodesRow] = await Promise.all([
    getRootNodes(ws.id, null),
    db
      .select({ n: count() })
      .from(roadmapTreeNodes)
      .where(eq(roadmapTreeNodes.workspaceId, ws.id)),
  ]);
  const totalNodes = totalNodesRow[0]?.n ?? 0;

  // Resolve the viewer (may be null on a true public visit) so we can show
  // the follow toggle only when logged in.
  const viewer = await getCurrentUser();
  const viewerFollowing =
    viewer && ws.ownerUserId !== viewer.id
      ? await isFollowingWorkspace(ws.id, viewer.id)
      : false;
  const showFollow = !!viewer && ws.ownerUserId !== viewer.id;

  // Same as dashboard: if exactly 1 root, use its title as hero + drill 1 level.
  let sections: Awaited<ReturnType<typeof getTreeSections>> = [];
  let heroTitle = ws.name;
  let heroSubtitle =
    'Lộ trình học tập — chế độ chia sẻ chỉ xem. Click vào pill để khám phá chi tiết.';
  if (rootNodes.length === 1) {
    const root = rootNodes[0]!;
    heroTitle = root.title;
    heroSubtitle = root.description ?? heroSubtitle;
    sections = await getTreeSections(ws.id, null, root.id);
  } else if (rootNodes.length > 1) {
    sections = await getTreeSections(ws.id, null, null);
  }

  const totalSections = sections.length;
  const totalSubs = sections.reduce((acc, s) => acc + s.subs.length, 0);

  return (
    <div
      className="mx-auto max-w-5xl px-4 py-10 md:py-16"
      style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
    >
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
          <span className="text-muted-foreground font-mono inline-flex items-center gap-1">
            👀 Read-only · {totalNodes} mục
          </span>
          {showFollow && (
            <FollowButton workspaceSlug={slug} initialFollowing={viewerFollowing} />
          )}
          <ShareLinkButton />
        </div>
      </div>

      {/* Stats row — structural (no progress) */}
      <div className="grid grid-cols-3 gap-3 mb-10 max-w-3xl mx-auto">
        <StatChip icon={Layers} label="Giai đoạn" value={String(totalSections)} sub="cấp 1" color="text-cyan-500" />
        <StatChip icon={Sparkles} label="Tuần / Buổi" value={String(totalSubs)} sub="cấp 2" color="text-violet-500" />
        <StatChip icon={Sparkles} label="Tổng mục" value={String(totalNodes)} sub="trong cây" color="text-amber-500" />
      </div>

      <RoadmapHero badge="Roadmap · Read-only share" title={heroTitle} subtitle={heroSubtitle} />

      <NumberedSection
        index={1}
        title="Lộ trình chi tiết"
        subtitle={`${totalSections} giai đoạn`}
      />

      <VerticalRoadmap
        sections={sections}
        workspaceSlug={slug}
        linkBase={`/share/${slug}/n`}
        readOnly
      />

      <RoadmapLegend />

      <div className="mt-10 text-center text-xs text-muted-foreground">
        <p>
          Trang chia sẻ chỉ xem · Để tự học và lưu tiến độ:{' '}
          <Link href={`/w/${slug}`} className="underline hover:text-foreground">
            mở trang học của bạn
          </Link>
        </p>
      </div>
    </div>
  );
}
