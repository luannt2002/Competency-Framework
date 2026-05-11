'use client';

import { LevelBadge } from '@/components/skills/level-badge';

export type HeatmapCell = {
  skillId: string;
  skillName: string;
  levelCode: string | null;
};
export type HeatmapRow = {
  categoryName: string;
  color: string | null;
  cells: HeatmapCell[];
};

const LVL_BG: Record<string, string> = {
  XS: 'bg-slate-500/40',
  S: 'bg-sky-500/60',
  M: 'bg-emerald-500/70',
  L: 'bg-violet-500/85',
};

export function SkillHeatmap({ rows }: { rows: HeatmapRow[] }) {
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.categoryName} className="flex items-center gap-3">
          <div
            className="w-28 shrink-0 text-xs font-medium truncate"
            style={{ color: r.color ?? undefined }}
          >
            {r.categoryName}
          </div>
          <div className="flex-1 flex gap-1 flex-wrap">
            {r.cells.map((c) => (
              <div
                key={c.skillId}
                title={`${c.skillName} · ${c.levelCode ?? 'unassessed'}`}
                className={`size-5 rounded-md border border-border/50 ${
                  c.levelCode ? LVL_BG[c.levelCode] ?? 'bg-secondary' : 'bg-secondary/40'
                }`}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Legend */}
      <div className="flex items-center gap-3 pt-3 text-xs text-muted-foreground">
        <span>Legend:</span>
        <LegendCell color="bg-secondary/40" label="—" />
        <LegendCell color="bg-slate-500/40" label="XS" />
        <LegendCell color="bg-sky-500/60" label="S" />
        <LegendCell color="bg-emerald-500/70" label="M" />
        <LegendCell color="bg-violet-500/85" label="L" />
      </div>
    </div>
  );
}

function LegendCell({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`size-3 rounded ${color}`} />
      <span className="font-mono">{label}</span>
    </span>
  );
}
