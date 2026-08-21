/**
 * Workspace-scoped layout — sidebar + topbar + main content.
 * Ensures user owns the workspace; throws otherwise.
 * Fetches gamification stats (today's XP, current streak, hearts) for the topbar.
 */
import { and, eq, gte, sum } from 'drizzle-orm';
import { AppSidebar, BottomTabBar } from '@/components/layout/app-sidebar';
import { Topbar } from '@/components/layout/topbar';
import { db } from '@/lib/db/client';
import { xpEvents, streaks as streaksT } from '@/lib/db/schema';
import { readHearts } from '@/lib/gamification/hearts';
import { requireUser } from '@/lib/auth/supabase-server';
import { getEffectiveLevel } from '@/lib/rbac/server';
import { requireWorkspaceAccess, listMyWorkspaces } from '@/lib/workspace';
import { workspaceAccentStyle } from '@/lib/theme/workspace-theme';

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ws = await requireWorkspaceAccess(slug);
  const user = await requireUser();

  // Start of today (UTC) — MVP good enough.
  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);

  const [xpTodayRow, streakRow, heartRow, myWorkspaces] = await Promise.all([
    db
      .select({ s: sum(xpEvents.amount) })
      .from(xpEvents)
      .where(
        and(
          eq(xpEvents.workspaceId, ws.id),
          eq(xpEvents.userId, user.id),
          gte(xpEvents.createdAt, startOfToday),
        ),
      ),
    db
      .select()
      .from(streaksT)
      .where(and(eq(streaksT.workspaceId, ws.id), eq(streaksT.userId, user.id)))
      .limit(1),
    // Cùng một nguồn số với API /hearts — rà F7 đo được topbar khoe 5/5 trong
    // khi API cùng lúc trả 0, vì hai nơi tự chọn giá trị mặc định khác nhau.
    readHearts(ws.id, user.id),
    listMyWorkspaces(),
  ]);

  const dailyXp = Number(xpTodayRow[0]?.s ?? 0);
  const streak = streakRow[0]?.currentStreak ?? 0;
  // Không có dòng hearts nghĩa là chưa khởi tạo — hiện 0 chứ đừng bịa 5.
  const hearts = heartRow?.current ?? 0;
  // Effective RBAC level for the sidebar admin section — per-item gating
  // (Members/Audit/Roster/Analytics need EDITOR, Settings needs OWNER).
  // getEffectiveLevel resolves owner + workspace_members + platform/dev-bypass.
  const { level: rbacLevel } = await getEffectiveLevel(ws.id, user.id);

  return (
    <div className="flex min-h-dvh">
      {/* Per-workspace accent theming — owner-picked color overrides the
          brand variables for this workspace only (multi-tenant theming). */}
      {ws.color && <style dangerouslySetInnerHTML={{ __html: workspaceAccentStyle(ws.color) }} />}
      {/* Skip-to-content — visually-hidden until keyboard-focused. Sighted
          users never see it; Tab users get instant access to the page body
          without having to traverse the sidebar + topbar each time. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground focus:shadow-lg"
      >
        Skip to main content
      </a>
      <AppSidebar
        workspaceSlug={ws.slug}
        workspaceName={ws.name}
        workspaceIcon={ws.icon}
        rbacLevel={rbacLevel}
        workspaces={myWorkspaces.map((w) => ({ slug: w.slug, name: w.name, icon: w.icon }))}
      />
      <div className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0">
        <Topbar
          workspaceSlug={ws.slug}
          workspaceName={ws.name}
          dailyXp={dailyXp}
          streak={streak}
          hearts={hearts}
        />
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 overflow-y-auto outline-none"
        >
          {children}
        </main>
      </div>
      <BottomTabBar workspaceSlug={ws.slug} />
    </div>
  );
}
