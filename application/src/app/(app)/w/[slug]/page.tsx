/**
 * Workspace Dashboard — vertical-tree roadmap entry.
 * Design inspired by hueanmy.github.io/claude-roadmap:
 *   - Gradient hero header
 *   - For each root: pill main-node, sub-row of children pills
 *   - Connectors flow downward
 *   - 5-color rotation (cyan / purple / yellow / green / pink)
 *
 * Click any pill (main or sub) → /w/[slug]/n/[node-slug] to drill down.
 */
import Link from 'next/link';
import { sum, eq, and, count } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { xpEvents, streaks as streaksT, hearts as heartsT, roadmapTreeNodes, userNodeProgress } from '@/lib/db/schema';
import { requireWorkspacePage } from '@/lib/workspace';
import { requireUser } from '@/lib/auth/supabase-server';
import { getRootNodes, getTreeSections, getLastInProgressNode } from '@/lib/tree/queries';
import { VerticalRoadmap, RoadmapHero, RoadmapLegend } from '@/components/learn/vertical-roadmap';
import { ShareLinkButton } from '@/components/learn/share-link-button';
import { StatChip } from '@/components/learn/stat-chip';
import { DashboardRail } from '@/components/learn/dashboard-rail';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Plus,
  Sparkles,
  Zap,
  Flame,
  Heart,
  Eye,
  ArrowRight,
  Play,
  Award,
  Calendar,
  NotebookPen,
} from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { NoNodesIllustration } from '@/components/ui/empty-state-illustrations';

export default async function DashboardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ws = await requireWorkspacePage(slug);
  const user = await requireUser();

  // Fetch root nodes + top-bar stats + last in-progress node in parallel
  const [rootNodes, xpRow, streakRow, heartRow, totalNodesRow, totalDoneRow, lastInProgress] = await Promise.all([
    getRootNodes(ws.id, user.id),
    db
      .select({ s: sum(xpEvents.amount) })
      .from(xpEvents)
      .where(and(eq(xpEvents.workspaceId, ws.id), eq(xpEvents.userId, user.id))),
    db
      .select()
      .from(streaksT)
      .where(and(eq(streaksT.workspaceId, ws.id), eq(streaksT.userId, user.id)))
      .limit(1),
    db
      .select()
      .from(heartsT)
      .where(and(eq(heartsT.workspaceId, ws.id), eq(heartsT.userId, user.id)))
      .limit(1),
    db
      .select({ n: count() })
      .from(roadmapTreeNodes)
      .where(eq(roadmapTreeNodes.workspaceId, ws.id)),
    db
      .select({ n: count() })
      .from(userNodeProgress)
      .where(
        and(
          eq(userNodeProgress.workspaceId, ws.id),
          eq(userNodeProgress.userId, user.id),
          eq(userNodeProgress.status, 'done'),
        ),
      ),
    getLastInProgressNode(ws.id, user.id),
  ]);

  const totalXp = Number(xpRow[0]?.s ?? 0);
  const streak = streakRow[0]?.currentStreak ?? 0;
  // No hearts row yet = the learner has not lost any; show a full bar rather
  // than a scary 0 (same default the topbar uses).
  const heartsMax = heartRow[0]?.max ?? 5;
  const hearts = heartRow[0]?.current ?? heartsMax;
  const totalNodes = totalNodesRow[0]?.n ?? 0;
  const totalDone = totalDoneRow[0]?.n ?? 0;
  const overallPct = totalNodes === 0 ? 0 : Math.round((totalDone / totalNodes) * 100);

  // For each root, fetch its children (phases) + grandchildren (weeks) as sections.
  // If there's only 1 root, drill down so we render phases as sections (canonical look).
  let sections: Awaited<ReturnType<typeof getTreeSections>> = [];
  let heroTitle = ws.name;
  let heroSubtitle = 'Cây học tập của bạn · click vào pill để xổ xuống lộ trình bên trong.';
  if (rootNodes.length === 1) {
    const root = rootNodes[0]!;
    heroTitle = root.title;
    heroSubtitle = root.description ?? heroSubtitle;
    sections = await getTreeSections(ws.id, user.id, root.id);
  } else if (rootNodes.length > 1) {
    // Multi-root: treat each root as a section, fetch its direct children as sub-row
    sections = await getTreeSections(ws.id, user.id, null);
  }

  // Pick the first incomplete top-level phase as a "Bắt đầu học" fallback when
  // the user has no in-progress nodes yet. Prefers visible sections (phases)
  // over raw root nodes so it lines up with what the dashboard renders.
  const firstIncomplete = (() => {
    const candidates = sections.length > 0
      ? sections.map((s) => s.main)
      : rootNodes;
    return candidates.find((n) => n.status !== 'done') ?? null;
  })();

  // "Ghi chú hôm nay" needs a node to hang the note off — journal entries are
  // node-scoped. Prefer where the learner left off, else the next open step.
  const noteTarget = lastInProgress ?? firstIncomplete;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 md:py-16">
      {/* Top action bar: share / overview */}
      <div className="flex items-center justify-end gap-2 mb-6">
        {overallPct >= 80 && (
          <Link
            href={`/w/${slug}/certificate/${user.id}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-amber-400/60 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
          >
            <Award className="size-3.5" /> Chứng nhận của tôi
          </Link>
        )}
        <Link
          href={`/share/${slug}`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-border bg-card hover:bg-secondary transition-colors"
          target="_blank"
        >
          <Eye className="size-3.5" /> Xem dạng showcase
        </Link>
        <ShareLinkButton label="Copy link share" url={`/share/${slug}`} />
      </div>

      {/* Resume / Start prompt — coral-accented surface above the stat strip */}
      {lastInProgress ? (
        <Link
          href={`/w/${slug}/n/${lastInProgress.slug}`}
          className="surface surface-lift p-4 flex items-center gap-4 mb-6 border-l-4 border-l-primary hover:border-l-primary/70 transition-colors"
        >
          <div className="text-2xl shrink-0" aria-hidden>🎯</div>
          <div className="min-w-0 flex-1">
            <div className="text-xs uppercase tracking-wider font-mono text-muted-foreground">
              Tiếp tục từ chỗ bạn dừng
            </div>
            <div className="font-semibold truncate">{lastInProgress.title}</div>
          </div>
          <ArrowRight className="size-5 text-primary shrink-0" />
        </Link>
      ) : firstIncomplete ? (
        <Link
          href={`/w/${slug}/n/${firstIncomplete.slug}`}
          className="surface surface-lift p-3 flex items-center gap-3 mb-6 text-sm hover:border-primary/40 transition-colors"
        >
          <Play className="size-4 text-primary shrink-0" />
          <span className="text-muted-foreground">Bắt đầu học:</span>
          <span className="font-medium truncate flex-1">{firstIncomplete.title}</span>
          <ArrowRight className="size-4 text-muted-foreground shrink-0" />
        </Link>
      ) : null}

      {/* Stat strip (compact, on top) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10 max-w-3xl mx-auto">
        <StatChip icon={Sparkles} label="Tiến độ" value={`${overallPct}%`} sub={`${totalDone}/${totalNodes}`} color="text-hue-1" />
        <StatChip icon={Zap} label="XP" value={totalXp.toLocaleString()} sub="all-time" color="text-amber-500" />
        <StatChip icon={Flame} label="Streak" value={String(streak)} sub="ngày" color="text-orange-500" />
        <StatChip icon={Heart} label="Hearts" value={`${hearts}/${heartsMax}`} sub="còn lại" color="text-rose-500" />
      </div>

      {/* Quick actions (Flow B3) — one click to today's plan / today's note. */}
      <div className="flex flex-wrap items-center justify-center gap-2 mb-10">
        <Link
          href={`/w/${slug}/daily`}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium transition-colors hover:bg-secondary"
        >
          <Calendar className="size-3.5 text-amber-500" /> Tới Daily Planner
        </Link>
        {noteTarget && (
          <Link
            href={`/w/${slug}/n/${noteTarget.slug}#quick-note`}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium transition-colors hover:bg-secondary"
          >
            <NotebookPen className="size-3.5 text-primary" /> Ghi chú hôm nay
          </Link>
        )}
        <Link
          href={`/w/${slug}/skills`}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium transition-colors hover:bg-secondary"
        >
          <Sparkles className="size-3.5 text-primary" /> Skills Matrix
        </Link>
      </div>

      {rootNodes.length === 0 ? (
        <EmptyState
          illustration={<NoNodesIllustration label="Chưa có cây học tập" />}
          title="Chưa có khoá học nào"
          description="Workspace này chưa có cây học tập. Tạo cây mới hoặc chạy seed CLI để import dữ liệu."
          action={
            <Button asChild>
              <Link href={`/w/${ws.slug}/new`}>
                <Plus className="size-4" />
                Tạo cây mới
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="min-w-0">
            <RoadmapHero badge={`${totalNodes} nodes`} title={heroTitle} subtitle={heroSubtitle} />
            <VerticalRoadmap sections={sections} workspaceSlug={slug} />
            <RoadmapLegend showStatus />
          </div>
          <DashboardRail workspaceId={ws.id} workspaceSlug={slug} userId={user.id} />
        </div>
      )}

      {/* Quick-help footer */}
      <Card className="mt-12">
        <CardContent className="p-4">
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground select-none">
              💡 Cách dùng (click để xem)
            </summary>
            <div className="mt-3 space-y-1 text-muted-foreground leading-relaxed">
              <p>• <b>Click pill chính</b> (giai đoạn / tuần) → drill xuống xem chi tiết.</p>
              <p>• <b>Click pill nhỏ</b> (sub-node) → xem cây con bên trong.</p>
              <p>• Mỗi cấp lại click tiếp → tới lá (bài học / lab) → trang detail có nội dung + toolbar.</p>
              <p>• Trong trang detail: <b>thêm con</b>, <b>sửa</b>, <b>xoá</b>, <b>đánh dấu xong</b>.</p>
              <p>• Quy tắc: <b>phải xong hết con mới đánh dấu xong cha được</b> (gate hierarchy).</p>
            </div>
          </details>
        </CardContent>
      </Card>
    </div>
  );
}

