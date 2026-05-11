'use client';

/**
 * TodayFocus — client component rendering today's planned tasks.
 *
 * Each row is a checkbox-style item with the task title, kind icon, est
 * minutes, and an action menu (skip / carry-over to tomorrow). All actions
 * call the server actions then router.refresh() to re-fetch the list.
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  BookOpen,
  Beaker,
  Flame,
  Sparkles,
  Target,
  CheckCircle2,
  Circle,
  Clock,
  MoreHorizontal,
  SkipForward,
  ArrowRightCircle,
  Loader2,
  Calendar,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  markTaskDone,
  markTaskSkipped,
  carryOverTask,
  type DailyTask,
  type DailyTaskKind,
} from '@/actions/daily-planner';

type Props = {
  workspaceSlug: string;
  tasks: DailyTask[];
};

const KIND_META: Record<
  DailyTaskKind,
  { icon: typeof BookOpen; label: string; accent: string }
> = {
  lesson: { icon: BookOpen, label: 'Lesson', accent: 'text-violet-400' },
  lab: { icon: Beaker, label: 'Lab', accent: 'text-cyan-400' },
  weak_skill_review: { icon: Target, label: 'Weak skill', accent: 'text-amber-400' },
  streak_keeper: { icon: Flame, label: 'Streak keeper', accent: 'text-orange-400' },
  stretch: { icon: Sparkles, label: 'Stretch', accent: 'text-emerald-400' },
};

export function TodayFocus({ workspaceSlug, tasks }: Props) {
  const router = useRouter();

  if (tasks.length === 0) {
    return <EmptyState onGenerate={() => router.refresh()} />;
  }

  return (
    <section className="surface overflow-hidden">
      <header className="p-4 border-b border-border bg-secondary/20 flex items-center gap-2">
        <Target className="size-4 text-amber-400" />
        <h3 className="font-semibold text-sm">Focus list</h3>
        <span className="text-xs text-muted-foreground">({tasks.length})</span>
      </header>
      <ul className="divide-y divide-border">
        {tasks.map((task) => (
          <TaskRow key={task.id} workspaceSlug={workspaceSlug} task={task} />
        ))}
      </ul>
    </section>
  );
}

function TaskRow({ workspaceSlug, task }: { workspaceSlug: string; task: DailyTask }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [menuOpen, setMenuOpen] = useState(false);

  const meta = KIND_META[task.kind as DailyTaskKind];
  const Icon = meta.icon;
  const done = task.status === 'done';
  const skipped = task.status === 'skipped';
  const carried = task.status === 'carried_over';

  const toggleDone = () => {
    if (pending || done) return;
    startTransition(async () => {
      try {
        await markTaskDone({ workspaceSlug, taskId: task.id });
        toast.success('Task completed', {
          description: task.title,
        });
        router.refresh();
      } catch (e) {
        toast.error('Could not complete', { description: String(e) });
      }
    });
  };

  const skip = () => {
    if (pending) return;
    setMenuOpen(false);
    startTransition(async () => {
      try {
        await markTaskSkipped({ workspaceSlug, taskId: task.id });
        toast.success('Task skipped');
        router.refresh();
      } catch (e) {
        toast.error('Skip failed', { description: String(e) });
      }
    });
  };

  const carry = () => {
    if (pending) return;
    setMenuOpen(false);
    startTransition(async () => {
      try {
        await carryOverTask({ workspaceSlug, taskId: task.id });
        toast.success('Carried over to tomorrow');
        router.refresh();
      } catch (e) {
        toast.error('Carry-over failed', { description: String(e) });
      }
    });
  };

  return (
    <li
      className={cn(
        'p-4 flex items-start gap-3 transition-colors',
        done && 'bg-emerald-500/5',
        skipped && 'opacity-60',
        carried && 'opacity-50 italic',
      )}
    >
      <button
        type="button"
        onClick={toggleDone}
        disabled={pending || done || skipped || carried}
        className="shrink-0 mt-0.5"
        aria-label={done ? 'Completed' : 'Mark as done'}
      >
        {pending ? (
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        ) : done ? (
          <CheckCircle2 className="size-5 text-emerald-400" />
        ) : (
          <Circle className="size-5 text-muted-foreground hover:text-foreground transition-colors" />
        )}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Icon className={cn('size-3.5', meta.accent)} />
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
            {meta.label}
          </span>
          {skipped && (
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              · skipped
            </span>
          )}
          {carried && (
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              · moved to tomorrow
            </span>
          )}
        </div>
        <p
          className={cn(
            'text-sm font-medium mt-0.5',
            done && 'line-through text-muted-foreground',
          )}
        >
          {task.title}
        </p>
        {task.description && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{task.description}</p>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <span className="text-xs text-muted-foreground tabular-nums flex items-center gap-1">
          <Clock className="size-3" />
          {task.estMinutes ?? 10}m
        </span>
        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => setMenuOpen((v) => !v)}
            disabled={pending || done || skipped || carried}
            aria-label="Task actions"
          >
            <MoreHorizontal className="size-3.5" />
          </Button>
          {menuOpen && (
            <>
              <button
                type="button"
                aria-hidden
                onClick={() => setMenuOpen(false)}
                className="fixed inset-0 z-10"
              />
              <div className="absolute right-0 top-8 z-20 min-w-[180px] rounded-xl border border-border bg-popover shadow-lg p-1">
                <button
                  type="button"
                  onClick={skip}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-secondary rounded-lg text-left"
                >
                  <SkipForward className="size-3.5" />
                  Skip today
                </button>
                <button
                  type="button"
                  onClick={carry}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-secondary rounded-lg text-left"
                >
                  <ArrowRightCircle className="size-3.5" />
                  Move to tomorrow
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </li>
  );
}

function EmptyState({ onGenerate }: { onGenerate: () => void }) {
  return (
    <section className="surface p-8 border-dashed border-amber-500/20 bg-amber-500/5 text-center space-y-3">
      <div className="flex flex-col items-center gap-2">
        <Calendar className="size-8 text-amber-400/60" />
        <Target className="size-8 text-amber-400" />
        <h3 className="font-semibold text-sm">Nothing planned yet</h3>
        <p className="text-xs text-muted-foreground max-w-sm">
          We will generate a focus list based on your current week, weak skills and streak status.
        </p>
        <Button onClick={onGenerate} className="mt-2">
          <Sparkles className="size-3" />
          Generate plan
        </Button>
      </div>
    </section>
  );
}
