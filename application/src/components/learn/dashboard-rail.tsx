/**
 * Dashboard side rail — the three panels USER_FLOWS.md → Flow B3 asks for:
 *
 *   Sidebar:
 *     → Recent activity
 *     → Upcoming: nodes tiếp theo chưa làm
 *     → Skills summary: bao nhiêu skill đã có
 *
 * Server Component: every panel reads straight from the DB, workspace- and
 * user-scoped. Empty panels say so rather than rendering placeholder rows
 * ("KHÔNG hiện placeholder data").
 */
import Link from 'next/link';
import { and, asc, desc, eq } from 'drizzle-orm';
import { ArrowRight, Clock, Crown, History, ListTodo, Sparkles } from 'lucide-react';
import { db } from '@/lib/db/client';
import { activityLog, skills, userSkillProgress } from '@/lib/db/schema';
import { activityIcon, activityLabel } from '@/lib/learn/activity-labels';
import { listUnfinishedLeafNodes } from '@/lib/learn/node-progress';
import { typeMeta } from '@/components/learn/node-card';

const RECENT_LIMIT = 6;
const UPCOMING_LIMIT = 5;

type Props = {
  workspaceId: string;
  workspaceSlug: string;
  userId: string;
};

export async function DashboardRail({ workspaceId, workspaceSlug, userId }: Props) {
  const [recent, upcoming, skillRows] = await Promise.all([
    db
      .select({
        id: activityLog.id,
        kind: activityLog.kind,
        createdAt: activityLog.createdAt,
      })
      .from(activityLog)
      .where(and(eq(activityLog.workspaceId, workspaceId), eq(activityLog.userId, userId)))
      .orderBy(desc(activityLog.createdAt))
      .limit(RECENT_LIMIT),
    listUnfinishedLeafNodes(workspaceId, userId, UPCOMING_LIMIT),
    db
      .select({
        skillId: skills.id,
        levelCode: userSkillProgress.levelCode,
        crowns: userSkillProgress.crowns,
      })
      .from(skills)
      .leftJoin(
        userSkillProgress,
        and(
          eq(userSkillProgress.skillId, skills.id),
          eq(userSkillProgress.workspaceId, workspaceId),
          eq(userSkillProgress.userId, userId),
        ),
      )
      .where(eq(skills.workspaceId, workspaceId))
      .orderBy(asc(skills.displayOrder)),
  ]);

  const assessed = skillRows.filter((r) => r.levelCode).length;
  const crowns = skillRows.reduce((acc, r) => acc + (r.crowns ?? 0), 0);

  return (
    <aside className="space-y-4" aria-label="Tổng quan bên cạnh">
      {/* ── Upcoming ─────────────────────────────────────────────── */}
      <Panel icon={<ListTodo className="size-4 text-primary" />} title="Sắp tới">
        {upcoming.length === 0 ? (
          <Muted>Không còn bước nào chưa làm. 🎉</Muted>
        ) : (
          <ul className="space-y-1.5">
            {upcoming.map((n) => {
              const meta = typeMeta(n.nodeType);
              return (
                <li key={n.id}>
                  <Link
                    href={`/w/${workspaceSlug}/n/${n.slug}`}
                    className="group flex items-start gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-secondary"
                  >
                    <span className="mt-0.5 text-xs shrink-0" aria-hidden>
                      {n.inProgress ? '◑' : '○'}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm group-hover:text-primary">
                        {n.title}
                      </span>
                      <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span>{meta.label}</span>
                        <span className="inline-flex items-center gap-0.5 tabular-nums">
                          <Clock className="size-2.5" />
                          {n.estMinutes}p
                        </span>
                        {n.inProgress && (
                          <span className="text-amber-500">đang học</span>
                        )}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      {/* ── Skills summary ───────────────────────────────────────── */}
      <Panel icon={<Sparkles className="size-4 text-primary" />} title="Kỹ năng">
        {skillRows.length === 0 ? (
          <Muted>Workspace này chưa có skills matrix.</Muted>
        ) : (
          <div className="space-y-3">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold tabular-nums">{assessed}</span>
              <span className="text-sm text-muted-foreground">
                / {skillRows.length} skill đã tự đánh giá
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full accent-gradient"
                style={{
                  width: `${Math.round((assessed / skillRows.length) * 100)}%`,
                }}
              />
            </div>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Crown className="size-3 text-yellow-500" />
              {crowns} crowns
            </p>
            <Link
              href={`/w/${workspaceSlug}/skills`}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              Mở Skills Matrix <ArrowRight className="size-3" />
            </Link>
          </div>
        )}
      </Panel>

      {/* ── Recent activity ──────────────────────────────────────── */}
      <Panel icon={<History className="size-4 text-emerald-500" />} title="Hoạt động gần đây">
        {recent.length === 0 ? (
          <Muted>Chưa có hoạt động nào. Đánh dấu xong một bước để bắt đầu.</Muted>
        ) : (
          <ul className="space-y-1.5">
            {recent.map((a) => (
              <li key={a.id} className="flex items-start gap-2 text-sm">
                <span className="shrink-0" aria-hidden>
                  {activityIcon(a.kind)}
                </span>
                <span className="min-w-0 flex-1 truncate">{activityLabel(a.kind)}</span>
                {a.createdAt && (
                  <time
                    dateTime={a.createdAt.toISOString()}
                    className="shrink-0 text-[11px] text-muted-foreground tabular-nums"
                  >
                    {a.createdAt.toISOString().slice(5, 10)}
                  </time>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </aside>
  );
}

function Panel({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="surface p-4">
      <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>;
}
