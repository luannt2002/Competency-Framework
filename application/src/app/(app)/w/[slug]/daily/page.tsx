/**
 * Daily Planner page — "Today" focus list.
 *
 * Server Component: invokes getOrGenerateDailyPlan() which is idempotent
 * (returns today's existing plan if any, otherwise generates fresh).
 * Renders header + progress bar + task list (client component for interactivity).
 */
import { Calendar, Clock, Sparkles, Target, Plus } from 'lucide-react';
import { requireWorkspaceAccess } from '@/lib/workspace';
import { getOrGenerateDailyPlan } from '@/actions/daily-planner';
import { TodayFocus } from '@/components/daily/today-focus';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default async function DailyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ws = await requireWorkspaceAccess(slug);
  const view = await getOrGenerateDailyPlan(ws.slug);

  const goalPct = view.dailyGoalXp > 0
    ? Math.min(100, Math.round((view.xpToday / view.dailyGoalXp) * 100))
    : 0;

  const planDate = new Date(`${view.planDate}T00:00:00`);
  const dateLabel = planDate.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className="mx-auto max-w-3xl p-6 md:p-8 space-y-6">
      {/* Header */}
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Calendar className="size-7 text-amber-400" />
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Today</h1>
            <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-3">
              <span>{dateLabel}</span>
              <span className="flex items-center gap-1 tabular-nums">
                <Clock className="size-3" />
                ~{view.totalEstMinutes}m planned
              </span>
              <span className="flex items-center gap-1 tabular-nums">
                <Sparkles className="size-3" />
                {view.tasks.length} {view.tasks.length === 1 ? 'task' : 'tasks'}
              </span>
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" disabled title="Quick-add coming soon">
          <Plus className="size-3" />
          Quick add
        </Button>
      </header>

      {/* Daily goal progress bar */}
      <section className="surface p-4 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 font-medium">
            <Target className="size-4 text-cyan-400" />
            Daily goal
          </span>
          <span className="tabular-nums text-muted-foreground">
            <span className={cn('font-mono font-semibold', goalPct >= 100 ? 'text-emerald-400' : 'text-foreground')}>
              {view.xpToday}
            </span>{' '}
            / {view.dailyGoalXp} XP
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              goalPct >= 100 ? 'bg-emerald-400' : 'accent-gradient',
            )}
            style={{ width: `${goalPct}%` }}
            aria-label={`${goalPct}% of daily goal`}
          />
        </div>
        {goalPct >= 100 && (
          <p className="text-xs text-emerald-400 flex items-center gap-1">
            <Sparkles className="size-3" />
            Daily goal reached — anything more is bonus!
          </p>
        )}
      </section>

      {/* Tasks */}
      <TodayFocus workspaceSlug={ws.slug} tasks={view.tasks} />
    </div>
  );
}
