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
import { workspaceMembers } from '@/lib/db/schema-rbac';
import { getRootNodes, getTreeSections } from '@/lib/tree/queries';
import { VerticalRoadmap, RoadmapHero, RoadmapLegend } from '@/components/learn/vertical-roadmap';
import { StatChip } from '@/components/learn/stat-chip';
import { ShareLinkButton } from '@/components/learn/share-link-button';
import { NumberedSection } from '@/components/ui/numbered-section';
import { FollowButton } from '@/components/social/follow-button';
import { getCurrentUser } from '@/lib/auth/supabase-server';
import { isFollowingWorkspace } from '@/actions/follows';
import { ArrowLeft, Layers, Sparkles } from 'lucide-react';
import { ForkButton } from '@/components/share/fork-button';

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
  // Workspace private: không tiết lộ tên/mô tả/OG trong metadata (C4.2).
  if (ws.visibility !== 'public-readonly') {
    return { title: 'Roadmap riêng tư · ' + SITE_NAME };
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

/** Owner hoặc member của workspace private được xem share page; ngoài ra không. */
async function isViewerAllowed(
  workspaceId: string,
  ownerUserId: string | null,
  userId: string,
): Promise<boolean> {
  if (ownerUserId === userId) return true;
  const rows = await db
    .select({ userId: workspaceMembers.userId })
    .from(workspaceMembers)
    .where(
      and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)),
    )
    .limit(1);
  return rows.length > 0;
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

  // Gate theo visibility (C4.2): workspace private chỉ owner/member được xem.
  // Trước đây trang này trả full content cho mọi slug — lộ lộ trình private.
  const viewer0 = await getCurrentUser();
  if (ws.visibility !== 'public-readonly') {
    const allowed = viewer0 && (await isViewerAllowed(ws.id, ws.ownerUserId, viewer0.id));
    if (!allowed) notFound();
  }

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
  const viewer = viewer0;
  const isOwner = !!viewer && ws.ownerUserId === viewer.id;
  const viewerFollowing =
    viewer && !isOwner
      ? await isFollowingWorkspace(ws.id, viewer.id)
      : false;
  const showFollow = !!viewer && !isOwner;

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
          <ForkButton
            sourceSlug={slug}
            viewerId={viewer?.id ?? null}
            isOwner={isOwner}
          />
          <ShareLinkButton />
        </div>
      </div>

      {/* Stats row — structural (no progress) */}
      <div className="grid grid-cols-3 gap-3 mb-10 max-w-3xl mx-auto">
        <StatChip icon={Layers} label="Giai đoạn" value={String(totalSections)} sub="cấp 1" color="text-hue-1" />
        <StatChip icon={Sparkles} label="Tuần / Buổi" value={String(totalSubs)} sub="cấp 2" color="text-hue-2" />
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

      {/* CTA bottom */}
      <div className="mt-14 rounded-2xl border border-dashed border-border bg-secondary/30 p-8 text-center space-y-4">
        {isOwner ? (
          <>
            <p className="text-sm font-medium">Đây là roadmap của bạn</p>
            <Link
              href={`/w/${slug}`}
              className="inline-flex items-center gap-2 text-sm underline hover:text-foreground text-muted-foreground"
            >
              Mở trang học →
            </Link>
          </>
        ) : (
          <>
            <p className="text-lg font-semibold">Thích lộ trình này?</p>
            <p className="text-sm text-muted-foreground">
              Fork về tài khoản của bạn để tự track tiến độ, gắn evidence và earn XP.
            </p>
            <div className="flex items-center justify-center">
              <ForkButton
                sourceSlug={slug}
                viewerId={viewer?.id ?? null}
                isOwner={isOwner}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Miễn phí · Không cần credit card · Fork xong là học được ngay
            </p>
          </>
        )}
      </div>
    </div>
  );
}
