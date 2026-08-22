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
import { eq, count, isNull, and, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { workspaces, roadmapTreeNodes } from '@/lib/db/schema';
import { userNodeProgress } from '@/lib/db/schema-tree';
import { averageCompletionPct, completionPct } from '@/lib/tree/completion';
import { getFullTree } from '@/lib/tree/full-tree';
import { ShareTree } from '@/components/share/share-tree';
import { RoadmapHero, RoadmapLegend } from '@/components/learn/vertical-roadmap';
import { StatChip } from '@/components/learn/stat-chip';
import { ShareLinkButton } from '@/components/learn/share-link-button';
import { NumberedSection } from '@/components/ui/numbered-section';
import { FollowButton } from '@/components/social/follow-button';
import { resolveShareableWorkspace } from '@/lib/share/guard';
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
  // Mô tả của chính workspace là nguồn thứ nhất. Mượn mô tả node gốc chỉ còn là
  // đường lùi cho dữ liệu cũ — và đường lùi đó vốn chỉ chạy khi cây có ĐÚNG một
  // gốc, nên trên thực tế nó chưa từng hiện (cả hai workspace public đều 2 gốc).
  const rootDescription =
    ws.description ?? (rootRow.length === 1 ? rootRow[0]?.description ?? null : null);

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
  // Gate visibility đi qua cửa chung — xem src/lib/share/guard.ts. Không tìm
  // thấy và không đủ quyền cùng trả 404 để người ngoài không dò được slug.
  const viewer0 = await getCurrentUser();
  const ws = await resolveShareableWorkspace(slug, viewer0?.id ?? null);
  if (!ws) notFound();

  // Read-only: no user-progress data fetched for the tree (share is structural).
  const [totalNodesRow, progressByUser] = await Promise.all([
    db
      .select({ n: count() })
      .from(roadmapTreeNodes)
      .where(eq(roadmapTreeNodes.workspaceId, ws.id)),
    // Audit 7.11 / A4 + A6 — one grouped query: per-user done counts among
    // users with ANY progress rows in this workspace (read-only, ws-scoped).
    db
      .select({
        userId: userNodeProgress.userId,
        done: sql<number>`count(*) filter (where ${userNodeProgress.status} = 'done')`.mapWith(Number),
      })
      .from(userNodeProgress)
      .where(eq(userNodeProgress.workspaceId, ws.id))
      .groupBy(userNodeProgress.userId),
  ]);
  const totalNodes = totalNodesRow[0]?.n ?? 0;

  let heroTitle = ws.name;
  // Mô tả của chính workspace đứng trước. Câu chung chung phía sau chỉ là chỗ
  // dựa khi chủ lộ trình chưa viết gì — trước đây nó là thứ DUY NHẤT hiện ra.
  let heroSubtitle =
    ws.description ??
    'Lộ trình học tập — chế độ chia sẻ chỉ xem. Toàn bộ cấu trúc hiển thị trên một trang.';

  // A4: avg completion % across learners with progress.
  const avgCompletionPct = averageCompletionPct(
    progressByUser.map((r) => r.done),
    totalNodes,
  );
  const hasLearnerProgress = progressByUser.length > 0;

  // A6: creator's own demo progress — only shown when the owner has rows.
  const ownerDone = ws.ownerUserId
    ? progressByUser.find((r) => r.userId === ws.ownerUserId)?.done
    : undefined;
  const ownerCompletionPct =
    ownerDone !== undefined ? completionPct(ownerDone, totalNodes) : null;

  // Resolve the viewer (may be null on a true public visit) so we can show
  // the follow toggle only when logged in.
  const viewer = viewer0;
  const isOwner = !!viewer && ws.ownerUserId === viewer.id;
  const viewerFollowing =
    viewer && !isOwner
      ? await isFollowingWorkspace(ws.id)
      : false;
  const showFollow = !!viewer && !isOwner;

  // Same as dashboard: if exactly 1 root, the root becomes the hero and its
  // children are the top-level sections (drilled 1 level for display only —
  // A3 keeps every DEEPER level visible below via ShareTree, all on one page).
  const fullTree = await getFullTree(ws.id);
  const heroRoot = fullTree.length === 1 ? fullTree[0]! : null;
  const treeRoots = heroRoot ? heroRoot.children : fullTree;
  if (heroRoot) {
    heroTitle = heroRoot.title;
    // Mô tả workspace vẫn thắng mô tả node gốc: nó là thứ chủ lộ trình viết ra
    // để giới thiệu, còn mô tả node gốc là nội dung học.
    heroSubtitle = ws.description ?? heroRoot.description ?? heroSubtitle;
  }

  const totalSections = treeRoots.length;
  const totalSubs = treeRoots.reduce((acc, s) => acc + s.children.length, 0);

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
            defaultName={`${ws.name} (Fork)`}
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
        <StatChip icon={Sparkles} label="Tổng mục" value={String(totalNodes)} sub={hasLearnerProgress ? `${avgCompletionPct}% người hoàn thành` : 'trong cây'} color="text-amber-500" />
      </div>

      {/* A6 — creator's demo progress: subtle, only when the owner has tracked anything */}
      {ownerCompletionPct !== null && (
        <div className="mb-6 max-w-3xl mx-auto space-y-1.5">
          <p className="text-xs text-muted-foreground">
            Người tạo đã hoàn thành {ownerCompletionPct}%
          </p>
          <div className="h-1.5 w-full max-w-xs rounded-full bg-secondary overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500/70 transition-all"
              style={{ width: `${ownerCompletionPct}%` }}
            />
          </div>
        </div>
      )}

      <RoadmapHero badge="Roadmap · Read-only share" title={heroTitle} subtitle={heroSubtitle} />

      <NumberedSection
        index={1}
        title="Lộ trình chi tiết"
        subtitle={`${totalSections} giai đoạn`}
      />

      {/* A3 — full-depth tree: every level visible on this one page (expand /
          collapse per group; no progress, no other controls). */}
      <ShareTree roots={treeRoots} linkBase={`/share/${slug}/n`} />

      <RoadmapLegend showStatus={false} />

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
                defaultName={`${ws.name} (Fork)`}
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
