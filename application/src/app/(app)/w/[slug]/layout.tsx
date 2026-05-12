/**
 * Workspace-scoped layout — sidebar + topbar + main content.
 * Ensures user owns the workspace; throws otherwise.
 * Fetches gamification stats (today's XP, current streak, hearts) for the topbar.
 */
import { and, eq, gte, sum } from 'drizzle-orm';
import { AppSidebar, BottomTabBar } from '@/components/layout/app-sidebar';
import { Topbar } from '@/components/layout/topbar';
import { db } from '@/lib/db/client';
import { xpEvents, streaks as streaksT, hearts as heartsT } from '@/lib/db/schema';
import { requireUser } from '@/lib/auth/supabase-server';
import { requireWorkspaceAccess, listMyWorkspaces } from '@/lib/workspace';

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
    db
      .select()
      .from(heartsT)
      .where(and(eq(heartsT.workspaceId, ws.id), eq(heartsT.userId, user.id)))
      .limit(1),
    listMyWorkspaces(),
  ]);

  const dailyXp = Number(xpTodayRow[0]?.s ?? 0);
  const streak = streakRow[0]?.currentStreak ?? 0;
  const hearts = heartRow[0]?.current ?? 5;
  // Owner gate for the sidebar admin section. The workspace owner is the
  // single source of truth via workspaces.owner_user_id (not workspace_members).
  const isOwner = ws.ownerUserId === user.id;

  return (
    <div className="flex min-h-dvh">
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
        isOwner={isOwner}
        workspaces={myWorkspaces.map((w) => ({ slug: w.slug, name: w.name }))}
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
