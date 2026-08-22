/**
 * /w/[slug]/analytics — Creator learning analytics (Flow C5, EDITOR+).
 *
 * Không phải audit log — trang này trả lời câu hỏi của creator:
 *   1. C5.1 Overview: bao nhiêu người đang học, % hoàn thành TB, ai còn active.
 *   2. C5.2 Stuck/drop-off: node nào đang làm learner kẹt (started, chưa done,
 *      không chạm lại >= 7 ngày).
 *   3. C5.3 Skill distribution: level trung bình + nguồn level per skill.
 *   4. C5.4 Insight action: link thẳng tới node page để creator sửa node.
 *
 * Access: requireMinLevel(workspace, EDITOR). Forbidden → redirect /w/[slug]
 * (giống /roster, /audit, /members).
 */
import Link from 'next/link';

import {
  BarChart3,
  Users,
  Flame,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  Grid3x3,
} from 'lucide-react';

import { RBAC_LEVELS } from '@/lib/rbac/levels';

import { StatChip } from '@/components/learn/stat-chip';
import { EmptyState } from '@/components/ui/empty-state';
import {
  getOverviewStats,
  getNodeStuckStats,
  getSkillDistribution,
  getWorkspaceNodeMeta,
} from '@/lib/analytics/queries';
import { buildBreadcrumb, stuckScore, formatIdleDays } from '@/lib/analytics/metrics';
import { requireAdminPage } from '@/lib/workspace';

const TOP_STUCK_LIMIT = 10;

export default async function AnalyticsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Một cửa duy nhất cho trang quản trị — xem lib/workspace.ts.
  const ws = await requireAdminPage(slug, RBAC_LEVELS.EDITOR);

  // Tất cả aggregate chạy song song; node meta dùng chung cho breadcrumb.
  const [overview, stuckByNode, skillRows, nodeMetas] = await Promise.all([
    getOverviewStats(ws.id),
    getNodeStuckStats(ws.id),
    getSkillDistribution(ws.id),
    getWorkspaceNodeMeta(ws.id),
  ]);

  const titlesById = new Map(nodeMetas.map((n) => [n.id, n.title]));
  const metaById = new Map(nodeMetas.map((n) => [n.id, n]));

  // Top-N stuck: chỉ node còn stuck > 0, sort theo số stuck rồi theo score.
  const stuckList = Array.from(stuckByNode.values())
    .filter((s) => s.stuck > 0)
    .map((s) => {
      const meta = metaById.get(s.nodeId);
      return {
        ...s,
        title: meta?.title ?? titlesById.get(s.nodeId) ?? s.nodeId,
        nodeSlug: meta?.slug ?? null,
        breadcrumb: meta
          ? buildBreadcrumb(meta.id, meta.pathStr, titlesById)
          : s.nodeId,
        score: stuckScore(s.stuck, s.started),
      };
    })
    .sort((a, b) => b.stuck - a.stuck || b.score - a.score)
    .slice(0, TOP_STUCK_LIMIT);

  const hasAnyLearning = overview.nodeCount > 0 && stuckByNode.size > 0;

  return (
    <div
      className="mx-auto max-w-6xl p-6 md:p-10 space-y-8"
      style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
    >
      <header className="flex items-center gap-4">
        <div className="size-12 rounded-2xl accent-gradient flex items-center justify-center shadow-lg shadow-hue-1/20">
          <BarChart3 className="size-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {ws.name} · ai đang học gì, kẹt ở đâu, kỹ năng đang lên đến đâu.
          </p>
        </div>
      </header>

      {/* C5.1 — Overview */}
      <section className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <StatChip
          icon={Users}
          label="Learners"
          value={String(overview.memberCount)}
          sub="owner + members"
          color="text-hue-1"
        />
        <StatChip
          icon={TrendingUp}
          label="Hoàn thành TB"
          value={`${overview.avgCompletionPct}%`}
          sub="trên toàn cây"
          color="text-amber-500"
        />
        <StatChip
          icon={Flame}
          label="Active 7 ngày"
          value={String(overview.activeThisWeek)}
          sub="activity/streak"
          color="text-emerald-500"
        />
        <StatChip
          icon={AlertTriangle}
          label="Node stuck"
          value={String(stuckList.length)}
          sub={`top ${TOP_STUCK_LIMIT}`}
          color="text-amber-500"
        />
      </section>

      {/* C5.2 — Stuck / drop-off per node */}
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Learner đang kẹt ở đâu?</h2>
          <p className="text-sm text-muted-foreground">
            Node đã có người bắt đầu nhưng chưa xong và không được chạm lại trong ≥ 7
            ngày.
          </p>
        </div>
        {!hasAnyLearning ? (
          <EmptyState
            icon={BarChart3}
            title="Chưa có dữ liệu học tập"
            description="Khi learner bắt đầu đánh dấu tiến độ trên cây học tập, insight sẽ xuất hiện ở đây."
          />
        ) : stuckList.length === 0 ? (
          <EmptyState
            icon={Flame}
            title="Không ai bị kẹt"
            description="Mọi node đã bắt đầu đều được học tiếp trong 7 ngày qua."
          />
        ) : (
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary/40 text-muted-foreground">
                  <tr className="text-left">
                    <th className="px-4 py-3 font-medium">Node</th>
                    <th className="px-4 py-3 font-medium">Vị trí</th>
                    <th className="px-4 py-3 font-medium text-right">Bắt đầu</th>
                    <th className="px-4 py-3 font-medium text-right">Xong</th>
                    <th className="px-4 py-3 font-medium text-right">Stuck ≥7d</th>
                    <th className="px-4 py-3 font-medium text-right">Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {stuckList.map((row) => (
                    <tr key={row.nodeId} className="border-t border-border">
                      <td className="px-4 py-3 font-medium">{row.title}</td>
                      <td className="px-4 py-3 text-muted-foreground max-w-64 truncate">
                        {row.breadcrumb}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{row.started}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-emerald-600">
                        {row.done}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-amber-600 font-semibold">
                        {row.stuck}
                        <span className="ml-1 text-xs text-muted-foreground">
                          ({row.score}%)
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {/* C5.4 — insight action: quay lại node để cải thiện */}
                        {row.nodeSlug ? (
                          <Link
                            href={`/w/${ws.slug}/n/${row.nodeSlug}`}
                            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
                          >
                            Xem node <ArrowRight className="size-3" />
                          </Link>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* C5.3 — Skills distribution */}
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Kỹ năng của team</h2>
          <p className="text-sm text-muted-foreground">
            Level trung bình theo thang của workspace và nguồn level: tự báo / học
            xong / verified.
          </p>
        </div>
        {skillRows.length === 0 ? (
          <EmptyState
            icon={Grid3x3}
            title="Chưa có skill progress nào"
            description="Khi learner tự đánh giá hoặc hoàn thành bài học có gắn kỹ năng, phân bố sẽ hiển thị ở đây."
          />
        ) : (
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary/40 text-muted-foreground">
                  <tr className="text-left">
                    <th className="px-4 py-3 font-medium">Kỹ năng</th>
                    <th className="px-4 py-3 font-medium text-right">Learners</th>
                    <th className="px-4 py-3 font-medium">Phân bố nguồn</th>
                    <th className="px-4 py-3 font-medium text-right">Level TB</th>
                    <th className="px-4 py-3 font-medium text-right">Crowns TB</th>
                  </tr>
                </thead>
                <tbody>
                  {skillRows.map((s) => {
                    // Mẫu số phải gồm ĐỦ bốn nguồn. Thiếu `both` thì learner
                    // duy nhất đang ở trạng thái đó không xuất hiện ở đâu cả,
                    // và cả ba thanh cùng rộng 0 dù cột "Learners" ghi 1.
                    const total = Math.max(
                      s.selfClaimed + s.learned + s.both + s.verified,
                      1,
                    );
                    return (
                      <tr key={s.skillId} className="border-t border-border">
                        <td className="px-4 py-3 font-medium">{s.skillName}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{s.learners}</td>
                        <td className="px-4 py-3">
                          {/* Simple stacked bar — chỉ dùng hue-N / semantic tokens */}
                          <div className="flex items-center gap-2">
                            <div className="flex h-2 w-40 overflow-hidden rounded-full bg-secondary">
                              <div
                                className="bg-hue-2"
                                style={{ width: `${(s.selfClaimed / total) * 100}%` }}
                              />
                              <div
                                className="bg-hue-3"
                                style={{ width: `${(s.learned / total) * 100}%` }}
                              />
                              <div
                                className="bg-hue-1"
                                style={{ width: `${(s.both / total) * 100}%` }}
                              />
                              <div
                                className="bg-emerald-500"
                                style={{ width: `${(s.verified / total) * 100}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground tabular-nums">
                              <span title="Tự nhận">{s.selfClaimed}</span> /{' '}
                              <span title="Đã học">{s.learned}</span> /{' '}
                              <span title="Tự nhận + đã học">{s.both}</span> /{' '}
                              <span className="text-emerald-600" title="Đã xác minh">
                                {s.verified}
                              </span>
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {/* `numeric_value` là thang 0–100 (XS=0, S=33, M=66,
                              L=100). In trần ra "33.0" thì người đọc không biết
                              trên thang nào — thêm mẫu số cho rõ. */}
                          {s.avgLevelValue === null ? (
                            '—'
                          ) : (
                            <>
                              {s.avgLevelValue.toFixed(0)}
                              <span className="text-muted-foreground">/100</span>
                            </>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {s.avgCrowns === null ? '—' : s.avgCrowns.toFixed(1)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <p className="text-xs text-muted-foreground">
        Định nghĩa &ldquo;stuck&rdquo;: đã bắt đầu node (bất kể todo/doing) nhưng chưa
        done và không cập nhật trong {formatIdleDays(7)}. Gửi reminder/nhắc nhở chưa
        thuộc phạm vi của trang này.
      </p>
    </div>
  );
}
