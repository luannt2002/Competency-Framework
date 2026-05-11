/**
 * Profile page — aggregate stats across all owned workspaces.
 */
import { eq, sum, count, desc } from 'drizzle-orm';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Trophy, Flame, Zap, BookOpen } from 'lucide-react';

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

  return (
    <div className="mx-auto max-w-4xl p-6 md:p-8 space-y-8">
      {/* Hero */}
      <header className="flex items-center gap-4">
        <div className="size-16 rounded-full accent-gradient flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-cyan-500/30">
          {(user.email ?? 'U').charAt(0).toUpperCase()}
        </div>
        <div>
          <h1 className="text-2xl font-bold">{user.email}</h1>
          <p className="text-sm text-muted-foreground">Member since {new Date(user.created_at ?? Date.now()).toLocaleDateString()}</p>
        </div>
      </header>

      {/* Stat row */}
      <section className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <StatCard icon={Zap} value={Number(xpTotal ?? 0).toLocaleString()} label="Total XP" color="text-amber-400" />
        <StatCard icon={Flame} value={currentStreak} label="Current streak" color="text-orange-400" />
        <StatCard icon={Flame} value={longestStreak} label="Longest streak" color="text-orange-300" />
        <StatCard icon={BookOpen} value={lessonsDone} label="Lessons done" color="text-cyan-400" />
      </section>

      {/* Badges */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="size-4 text-amber-400" />
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
            <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 md:grid-cols-4">
              {earnedBadges.map((b) => (
                <div
                  key={b.slug}
                  className="surface p-3 text-center hover:bg-secondary/40 transition-colors"
                  title={b.description ?? ''}
                >
                  <div className="text-2xl mb-1">🏅</div>
                  <div className="text-sm font-medium truncate">{b.name}</div>
                  <div className="text-[10px] text-muted-foreground mt-1">
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
          <CardTitle>My Workspaces ({workspaces.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {workspaces.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No workspaces yet.{' '}
              <Link href="/onboarding" className="underline">
                Fork a framework
              </Link>
              .
            </div>
          ) : (
            workspaces.map((w) => (
              <Link
                key={w.id}
                href={`/w/${w.slug}`}
                className="flex items-center gap-3 rounded-xl border border-border bg-secondary/30 px-4 py-3 transition-colors hover:bg-secondary"
              >
                <div className="size-8 rounded-lg accent-gradient flex items-center justify-center text-white font-bold text-sm">
                  {w.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-sm">{w.name}</div>
                  <div className="text-xs text-muted-foreground">/{w.slug}</div>
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

function StatCard({
  icon: Icon,
  value,
  label,
  color,
}: {
  icon: typeof Zap;
  value: string | number;
  label: string;
  color: string;
}) {
  return (
    <div className="surface p-4">
      <Icon className={`size-5 mb-2 ${color}`} />
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
