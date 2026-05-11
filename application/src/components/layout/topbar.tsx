/**
 * Topbar: shows workspace title, gamification stats (XP/streak/hearts) and command palette stub.
 * MVP: stats are placeholder; M5 will wire them to real data.
 */
'use client';

import { Search, Flame, Heart, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Props = {
  workspaceName: string;
  dailyXp?: number;
  streak?: number;
  hearts?: number;
};

export function Topbar({ workspaceName, dailyXp = 0, streak = 0, hearts = 5 }: Props) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/85 backdrop-blur px-4 md:px-6">
      <h1 className="text-sm font-semibold truncate md:hidden">{workspaceName}</h1>

      <button
        className="hidden md:flex flex-1 max-w-md items-center gap-2 rounded-xl border border-border bg-secondary/50 px-3 py-1.5 text-sm text-muted-foreground hover:bg-secondary transition-colors"
        type="button"
      >
        <Search className="size-4" />
        <span>Search skills, lessons...</span>
        <kbd className="ml-auto rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-mono">⌘K</kbd>
      </button>

      <div className="ml-auto flex items-center gap-1.5">
        <StatChip icon={Zap} value={dailyXp} label="XP today" color="text-amber-400" />
        <StatChip icon={Flame} value={streak} label="Streak" color="text-orange-400" />
        <StatChip icon={Heart} value={hearts} label="Hearts" color="text-red-400" />
      </div>
    </header>
  );
}

function StatChip({
  icon: Icon,
  value,
  label,
  color,
}: {
  icon: typeof Flame;
  value: number;
  label: string;
  color: string;
}) {
  return (
    <div
      className="flex items-center gap-1 rounded-full border border-border bg-secondary/50 px-2.5 py-1 text-xs font-semibold tabular-nums"
      title={label}
    >
      <Icon className={`size-3.5 ${color}`} />
      <span>{value}</span>
    </div>
  );
}
