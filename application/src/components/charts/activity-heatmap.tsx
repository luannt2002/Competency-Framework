'use client';

/**
 * GitHub-style learning activity heatmap.
 * Last 12 weeks, 7 days each (84 cells). Server passes daily XP totals.
 */

import { useMemo } from 'react';

export type DailyXp = {
  date: string; // YYYY-MM-DD
  xp: number;
};

type Props = {
  data: DailyXp[];
  weeks?: number; // default 12
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function bucketClass(xp: number): string {
  if (xp === 0) return 'bg-secondary/40';
  if (xp < 30) return 'bg-cyan-500/30';
  if (xp < 100) return 'bg-cyan-500/60';
  if (xp < 200) return 'bg-violet-500/70';
  return 'bg-gradient-to-br from-cyan-400 to-violet-500';
}

export function ActivityHeatmap({ data, weeks = 12 }: Props) {
  const grid = useMemo(() => buildGrid(data, weeks), [data, weeks]);

  return (
    <div className="overflow-x-auto">
      <div className="inline-flex gap-1">
        {/* Day labels */}
        <div className="flex flex-col gap-1 pr-1 pt-4">
          {DAYS.map((d, i) => (
            <span
              key={d}
              className={`text-[9px] text-muted-foreground h-3 flex items-center ${
                i % 2 === 1 ? 'opacity-100' : 'opacity-0'
              }`}
            >
              {d}
            </span>
          ))}
        </div>

        {grid.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            <span className="text-[9px] text-muted-foreground h-3 flex items-end justify-center">
              {wi === 0 || week[0]?.date.endsWith('-01') ? monthShort(week[0]?.date) : ''}
            </span>
            {week.map((cell, di) => (
              <div
                key={di}
                title={`${cell.date} · ${cell.xp} XP`}
                className={`size-3 rounded-sm transition-transform hover:scale-125 ${bucketClass(cell.xp)}`}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-3 flex items-center gap-2 text-[10px] text-muted-foreground">
        <span>Less</span>
        <span className="size-3 rounded-sm bg-secondary/40" />
        <span className="size-3 rounded-sm bg-cyan-500/30" />
        <span className="size-3 rounded-sm bg-cyan-500/60" />
        <span className="size-3 rounded-sm bg-violet-500/70" />
        <span className="size-3 rounded-sm bg-gradient-to-br from-cyan-400 to-violet-500" />
        <span>More</span>
      </div>
    </div>
  );
}

function buildGrid(data: DailyXp[], weeks: number): DailyXp[][] {
  const map = new Map(data.map((d) => [d.date, d.xp]));
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  // Roll back to last Sunday
  const dayOfWeek = today.getUTCDay();
  const start = new Date(today);
  start.setUTCDate(today.getUTCDate() - dayOfWeek - (weeks - 1) * 7);

  const grid: DailyXp[][] = [];
  for (let w = 0; w < weeks; w++) {
    const col: DailyXp[] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(start);
      date.setUTCDate(start.getUTCDate() + w * 7 + d);
      const iso = date.toISOString().slice(0, 10);
      col.push({ date: iso, xp: map.get(iso) ?? 0 });
    }
    grid.push(col);
  }
  return grid;
}

function monthShort(date?: string): string {
  if (!date) return '';
  const m = new Date(date).getUTCMonth();
  return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m] ?? '';
}
