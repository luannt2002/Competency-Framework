/**
 * Profile page — aggregate stats across all owned workspaces.
 */
import { eq, sum, count, desc, sql as dsql } from 'drizzle-orm';
import Link from 'next/link';
import { requireUser } from '@/lib/auth/supabase-server';
import { listMyWorkspaces } from '@/lib/workspace';
import { db } from '@/lib/db/client';
import {
  xpEvents,
  userBadges,
  badges,
  streaks,
  userLessonProgress,
} from '@/lib/db/schema';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Plus, Trophy, Flame, Zap, BookOpen, CalendarDays, Boxes } from 'lucide-react';
import { ActivityHeatmap, type DailyXp } from '@/components/charts/activity-heatmap';
import { StatChip } from '@/components/learn/stat-chip';

export default async function ProfilePage() {
  const user = await requireUser();
  const workspaces = await listMyWorkspaces();

  // Aggregate XP across all workspaces
  const [{ xpTotal } = { xpTotal: 0 }] = await db
    .select({ xpTotal: sum(xpEvents.amount) })
    .from(xpEvents)
    .where(eq(xpEvents.userId, user.id));

  // Longest streak across workspaces
  const streakRows = await db
    .select()
    .from(streaks)
    .where(eq(streaks.userId, user.id));
  const longestStreak = streakRows.reduce((m, r) => Math.max(m, r.longestStreak ?? 0), 0);
  const currentStreak = streakRows.reduce((m, r) => Math.max(m, r.currentStreak ?? 0), 0);

  // Lessons completed
  const [{ lessonsDone } = { lessonsDone: 0 }] = await db
    .select({ lessonsDone: count() })
    .from(userLessonProgress)
    .where(eq(userLessonProgress.userId, user.id));

  // Daily XP buckets last 84 days for heatmap
  const sinceIso = new Date(Date.now() - 84 * 24 * 3600 * 1000).toISOString();
  const dayExpr = dsql<string>`to_char(${xpEvents.createdAt} at time zone 'UTC', 'YYYY-MM-DD')`;
  const dailyRows = await db
    .select({
      day: dayExpr,
      total: sum(xpEvents.amount),
    })
    .from(xpEvents)
    .where(dsql`${xpEvents.userId} = ${user.id} AND ${xpEvents.createdAt} >= ${sinceIso}`)
    .groupBy(dayExpr);
  const heatmapData: DailyXp[] = dailyRows.map((r) => ({
    date: r.day,
    xp: Number(r.total ?? 0),
  }));

  // Badges earned (join via badges table for names)
  const earnedBadges = await db
    .select({
      slug: badges.slug,
      name: badges.name,
      description: badges.description,
      icon: badges.icon,
      grantedAt: userBadges.grantedAt,
    })
    .from(userBadges)
    .innerJoin(badges, eq(badges.id, userBadges.badgeId))
    .where(eq(userBadges.userId, user.id))
    .orderBy(desc(userBadges.grantedAt));

  const memberSince = new Date(user.created_at ?? Date.now()).toLocaleDateString();

  return (
    <div
      className="mx-auto max-w-4xl p-6 md:p-8 space-y-8"
      style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
    >
      {/* Hero */}
      <header className="flex items-center gap-5">
        <div className="size-16 rounded-full accent-gradient flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-cyan-500/20">
          {(user.email ?? 'U').charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight truncate">{user.email}</h1>
          <p className="text-sm text-muted-foreground mt-1">Member since {memberSince}</p>
        </div>
      </header>

      {/* Stat row */}
      <section className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <StatChip
          icon={Zap}
          value={Number(xpTotal ?? 0).toLocaleString()}
          label="Total XP"
          sub="across all workspaces"
          color="text-amber-600"
        />
        <StatChip
          icon={Flame}
          value={String(currentStreak)}
          label="Current streak"
          sub={currentStreak === 1 ? 'day' : 'days'}
          color="text-orange-600"
        />
        <StatChip
          icon={Flame}
          value={String(longestStreak)}
          label="Longest streak"
          sub="personal best"
          color="text-orange-500"
        />
        <StatChip
          icon={BookOpen}
          value={String(lessonsDone)}
          label="Lessons done"
          sub="completed"
          color="text-cyan-600"
        />
      </section>

      {/* Activity heatmap */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarDays className="size-4 text-cyan-600" />
            Learning activity · last 12 weeks
          </CardTitle>
          <CardDescription>XP earned per day, GitHub-style.</CardDescription>
        </CardHeader>
        <CardContent>
          <ActivityHeatmap data={heatmapData} />
        </CardContent>
      </Card>

      {/* Badges */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="size-4 text-amber-600" />
            Badges earned ({earnedBadges.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {earnedBadges.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No badges yet. Complete lessons to unlock them.
            </p>
          )}
          {earnedBadges.length > 0 && (
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4">
              {earnedBadges.map((b) => (
                <div
                  key={b.slug}
                  className="surface p-4 text-center transition-colors hover:bg-secondary/60"
                  title={b.description ?? ''}
                >
                  <div className="text-3xl mb-2">🏅</div>
                  <div className="text-sm font-semibold truncate text-foreground">{b.name}</div>
                  <div className="text-[10px] text-muted-foreground mt-1 font-mono uppercase tracking-wider">
                    {b.grantedAt ? new Date(b.grantedAt).toLocaleDateString() : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Workspaces */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Boxes className="size-4 text-violet-600" />
            My Workspaces ({workspaces.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {workspaces.length === 0 ? (
            <EmptyState
              className="border-0 bg-transparent shadow-none p-6"
              icon={Boxes}
              title="No workspaces yet"
              description="Fork a competency framework to start tracking skills, climbing levels, and earning XP."
              action={
                <Button asChild>
                  <Link href="/onboarding">
                    <Plus className="size-4" />
                    Fork a framework
                  </Link>
                </Button>
              }
            />
          ) : (
            workspaces.map((w) => (
              <Link
                key={w.id}
                href={`/w/${w.slug}`}
                className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:bg-secondary/60 hover:border-primary/30"
              >
                <div className="size-9 rounded-lg accent-gradient flex items-center justify-center text-white font-bold text-sm shadow-sm">
                  {w.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{w.name}</div>
                  <div className="text-xs text-muted-foreground font-mono">/{w.slug}</div>
                </div>
              </Link>
            ))
          )}

          <Button asChild variant="outline" className="w-full mt-3">
            <Link href="/onboarding">
              <Plus className="size-4" />
              New workspace
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
