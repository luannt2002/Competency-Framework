/**
 * Workspace Dashboard — Tree-first navigation entry.
 * Shows root nodes of the roadmap_tree_nodes as large cards.
 * Click a card → /w/[slug]/n/[node-slug] to drill down recursively.
 *
 * No tabs. The tree IS the navigation. Sidebar minimal.
 */
import Link from 'next/link';
import { sum, eq, and, count } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { xpEvents, streaks as streaksT, hearts as heartsT, roadmapTreeNodes, userNodeProgress } from '@/lib/db/schema';
import { requireWorkspaceAccess } from '@/lib/workspace';
import { requireUser } from '@/lib/auth/supabase-server';
import { getRootNodes } from '@/lib/tree/queries';
import { NodeCard } from '@/components/learn/node-card';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Sparkles, Zap, Flame, Heart, GraduationCap } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';

export default async function DashboardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ws = await requireWorkspaceAccess(slug);
  const user = await requireUser();

  // Fetch root nodes + topbar stats in parallel
  const [rootNodes, xpRow, streakRow, heartRow, totalNodesRow, totalDoneRow] = await Promise.all([
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
  ]);

  const totalXp = Number(xpRow[0]?.s ?? 0);
  const streak = streakRow[0]?.currentStreak ?? 0;
  const hearts = heartRow[0]?.current ?? 0;
  const totalNodes = totalNodesRow[0]?.n ?? 0;
  const totalDone = totalDoneRow[0]?.n ?? 0;
  const overallPct = totalNodes === 0 ? 0 : Math.round((totalDone / totalNodes) * 100);

  return (
    <div className="mx-auto max-w-6xl p-6 md:p-8 space-y-8">
      {/* Hero */}
      <header className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="size-12 rounded-2xl accent-gradient flex items-center justify-center shadow-lg shadow-cyan-500/30">
            <GraduationCap className="size-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{ws.name}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Cây học tập của bạn · click vào 1 node để xổ ra lộ trình bên trong
            </p>
          </div>
        </div>

        {/* Stat strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatChip icon={Sparkles} label="Tổng tiến độ" value={`${overallPct}%`} sub={`${totalDone}/${totalNodes} node`} color="text-cyan-400" />
          <StatChip icon={Zap} label="Tổng XP" value={totalXp.toLocaleString()} sub="all-time" color="text-amber-400" />
          <StatChip icon={Flame} label="Streak" value={String(streak)} sub="ngày liên tiếp" color="text-orange-400" />
          <StatChip icon={Heart} label="Hearts" value={String(hearts)} sub="còn lại" color="text-red-400" />
        </div>
      </header>

      {/* Root nodes section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Khoá học · Lộ trình của bạn</h2>
          <span className="text-xs text-muted-foreground">
            {rootNodes.length} cây gốc
          </span>
        </div>

        {rootNodes.length === 0 ? (
          <EmptyState
            icon={GraduationCap}
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
          <div className="grid gap-4 md:grid-cols-2">
            {rootNodes.map((node) => (
              <NodeCard key={node.id} node={node} workspaceSlug={slug} size="lg" />
            ))}
          </div>
        )}
      </section>

      {/* Quick-help footer */}
      <Card>
        <CardContent className="p-4">
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground select-none">
              💡 Cách dùng (click để xem)
            </summary>
            <div className="mt-3 space-y-1 text-muted-foreground leading-relaxed">
              <p>• <b>Click 1 card</b> ở trên → drill xuống xem cây con của khoá đó.</p>
              <p>• Mỗi cấp lại click tiếp → tới khi gặp lá (bài học / lab / task) → vào trang detail.</p>
              <p>• Trong trang detail: <b>thêm con</b>, <b>sửa</b>, <b>xoá</b>, <b>đánh dấu xong</b>, <b>note kinh nghiệm</b>.</p>
              <p>• Quy tắc: <b>phải xong hết con mới đánh dấu xong cha được</b> (gate hierarchy).</p>
              <p>• Sidebar chỉ có 3 mục: Cây học tập (đang xem), Hôm nay (planner), Kỹ năng (matrix).</p>
            </div>
          </details>
        </CardContent>
      </Card>
    </div>
  );
}

function StatChip({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: typeof Sparkles;
  label: string;
  value: string;
  sub: string;
  color: string;
}) {
  return (
    <div className="surface p-3 flex items-center gap-3">
      <Icon className={`size-5 ${color}`} />
      <div className="min-w-0">
        <div className="text-lg font-bold tabular-nums leading-tight">{value}</div>
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
        <div className="text-[10px] text-muted-foreground truncate">{sub}</div>
      </div>
    </div>
  );
}
