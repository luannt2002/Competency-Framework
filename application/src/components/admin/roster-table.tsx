/**
 * RosterTable — client-side roster grid with search filter + breakdown drawer.
 *
 * Renders the member×phase heatmap grid produced by /w/[slug]/roster. Each
 * cell uses a coral background tinted by the completion percentage:
 *   0%   → empty (transparent)
 *   100% → full coral (var(--accent) at full alpha)
 *
 * Clicking a row opens a right-side sheet with the per-phase numeric
 * breakdown (this is the "per-node breakdown" surface — for MVP we expose the
 * phase totals & done counts; node-level breakdown can be added later).
 *
 * The filter input narrows visible rows by user_id substring (case-insensitive).
 */
'use client';

import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';

export type RosterPhaseColumn = {
  id: string;
  title: string;
  nodeType: string;
  total: number;
};

export type RosterMemberData = {
  /** Stable row key; either `owner:<uuid>` or workspace_members.id. */
  key: string;
  userId: string;
  role: string;
  isOwner: boolean;
  perPhase: { phaseId: string; done: number; total: number; pct: number }[];
  overallPct: number;
};

function shortId(id: string): string {
  if (id.length <= 10) return id;
  return `${id.slice(0, 4)}…${id.slice(-4)}`;
}

function roleLabel(role: string): string {
  switch (role) {
    case 'workspace_owner':
      return 'Owner';
    case 'workspace_editor':
      return 'Editor';
    case 'workspace_contributor':
      return 'Contributor';
    case 'learner':
      return 'Learner';
    case 'viewer':
      return 'Viewer';
    default:
      return role;
  }
}

/** Compose an inline style for a heatmap cell. `pct` 0-100. */
function cellStyle(pct: number): React.CSSProperties {
  if (pct <= 0) {
    return { backgroundColor: 'transparent' };
  }
  // Coral accent (oklch-friendly via rgba fallback). Alpha scales 0.08 → 0.95
  // so even 1% is faintly visible while 100% reaches full saturation.
  const alpha = 0.08 + (pct / 100) * 0.87;
  return { backgroundColor: `rgba(255, 122, 89, ${alpha.toFixed(3)})` };
}

export function RosterTable({
  phases,
  members,
}: {
  phases: RosterPhaseColumn[];
  members: RosterMemberData[];
}) {
  const [filter, setFilter] = useState('');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => m.userId.toLowerCase().includes(q));
  }, [filter, members]);

  const selected = useMemo(
    () => members.find((m) => m.key === selectedKey) ?? null,
    [members, selectedKey],
  );

  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter members by user_id substring…"
          className="pl-9 pr-9"
        />
        {filter && (
          <button
            type="button"
            onClick={() => setFilter('')}
            aria-label="Clear filter"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-secondary"
          >
            <X className="size-3" />
          </button>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-muted-foreground">
              <tr className="text-left">
                <th className="px-4 py-3 font-medium sticky left-0 bg-secondary/40 z-10">
                  Member
                </th>
                <th className="px-3 py-3 font-medium">Role</th>
                {phases.map((p) => (
                  <th
                    key={p.id}
                    className="px-3 py-3 font-medium text-center min-w-[110px]"
                    title={`${p.title} · ${p.total} nodes`}
                  >
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-[10px] uppercase tracking-wider opacity-70">
                        {p.nodeType}
                      </span>
                      <span className="text-xs font-semibold truncate max-w-[140px]">
                        {p.title}
                      </span>
                    </div>
                  </th>
                ))}
                <th className="px-3 py-3 font-medium text-right">Overall</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={phases.length + 3}
                    className="px-4 py-8 text-center text-muted-foreground text-xs"
                  >
                    No members match `{filter}`.
                  </td>
                </tr>
              ) : (
                filtered.map((m) => (
                  <tr
                    key={m.key}
                    onClick={() => setSelectedKey(m.key)}
                    className="border-t border-border hover:bg-secondary/20 cursor-pointer"
                  >
                    <td
                      className="px-4 py-3 font-mono text-xs sticky left-0 bg-card group-hover:bg-secondary/20"
                      style={{ fontFamily: 'var(--font-jetbrains), monospace' }}
                    >
                      <div className="flex items-center gap-2">
                        <span>{shortId(m.userId)}</span>
                        {m.isOwner && (
                          <span className="rounded-md bg-amber-500/15 text-amber-500 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider">
                            owner
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-xs">
                      <span className="inline-flex items-center rounded-md bg-secondary/60 px-2 py-0.5 text-[10px] font-medium text-foreground/80">
                        {roleLabel(m.role)}
                      </span>
                    </td>
                    {m.perPhase.map((c) => (
                      <td
                        key={c.phaseId}
                        className="px-3 py-3 text-center"
                        style={cellStyle(c.pct)}
                        title={`${c.done} / ${c.total} done`}
                      >
                        <span className="text-xs font-semibold tabular-nums">
                          {c.total === 0 ? '—' : `${c.pct}%`}
                        </span>
                      </td>
                    ))}
                    <td className="px-3 py-3 text-right">
                      <span className="text-sm font-bold tabular-nums">
                        {m.overallPct}%
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Sheet
        open={selected !== null}
        onOpenChange={(v) => {
          if (!v) setSelectedKey(null);
        }}
      >
        <SheetContent className="overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>
                  <span
                    className="font-mono"
                    style={{ fontFamily: 'var(--font-jetbrains), monospace' }}
                  >
                    {shortId(selected.userId)}
                  </span>
                  {selected.isOwner && (
                    <span className="ml-2 rounded-md bg-amber-500/15 text-amber-500 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider align-middle">
                      owner
                    </span>
                  )}
                </SheetTitle>
                <SheetDescription>
                  {roleLabel(selected.role)} · {selected.overallPct}% overall
                </SheetDescription>
              </SheetHeader>

              <div className="p-6 space-y-3">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Per-phase breakdown
                </div>
                <ul className="space-y-2.5">
                  {selected.perPhase.map((c, idx) => {
                    const phase = phases[idx]!;
                    return (
                      <li
                        key={c.phaseId}
                        className="rounded-xl border border-border bg-secondary/30 p-3 space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-semibold truncate">
                            {phase.title}
                          </span>
                          <span className="text-xs tabular-nums shrink-0">
                            {c.done} / {c.total}
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-border overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${c.pct}%`,
                              backgroundColor: 'rgb(255, 122, 89)',
                            }}
                          />
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {c.pct}% complete
                        </div>
                      </li>
                    );
                  })}
                </ul>

                <p className="text-[10px] text-muted-foreground pt-2">
                  Full user_id:{' '}
                  <span
                    className="font-mono"
                    style={{ fontFamily: 'var(--font-jetbrains), monospace' }}
                  >
                    {selected.userId}
                  </span>
                </p>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
