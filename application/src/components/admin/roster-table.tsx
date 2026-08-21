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

import { useEffect, useMemo, useState } from 'react';
import { Check, Circle, Loader2, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { HEATMAP_RGB } from '@/lib/constants/palette';
import {
  AT_RISK_DAYS,
  daysSinceISO,
  formatLastActive,
  roleLabel,
} from '@/lib/admin/roster-format';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';

// Re-exported for backwards compatibility (tests / pages import these from here).
export { AT_RISK_DAYS, daysSinceISO, formatLastActive };

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
  /** Tên/email thật từ Supabase Auth (D3.2) — fallback shortId. */
  displayName: string;
  role: string;
  isOwner: boolean;
  perPhase: { phaseId: string; done: number; total: number; pct: number }[];
  overallPct: number;
  /** ISO timestamp hoạt động gần nhất (D3.3); null = chưa có ghi nhận. */
  lastActiveISO: string | null;
  /** D3.4 — đã bắt đầu AND ≥ 7 ngày không hoạt động AND < 100%. */
  atRisk: boolean;
};

/** Node-level row from GET /api/workspaces/[slug]/roster/[userId]/nodes (D4.2). */
export type RosterNodeStatus = {
  id: string;
  title: string;
  nodeType: string;
  depth: number;
  done: boolean;
};
export type RosterMemberNodesPhase = {
  id: string;
  title: string;
  nodeType: string;
  done: number;
  total: number;
  nodes: RosterNodeStatus[];
};

/** Compose an inline style for a heatmap cell. `pct` 0-100. */
function cellStyle(pct: number): React.CSSProperties {
  if (pct <= 0) {
    return { backgroundColor: 'transparent' };
  }
  // Brand accent tinted by alpha 0.08 → 0.95, so even 1% stays faintly
  // visible while 100% reaches full saturation. One hue, one quantity.
  const alpha = 0.08 + (pct / 100) * 0.87;
  return { backgroundColor: `rgba(${HEATMAP_RGB}, ${alpha.toFixed(3)})` };
}

export function RosterTable({
  phases,
  members,
  workspaceSlug,
}: {
  phases: RosterPhaseColumn[];
  members: RosterMemberData[];
  /** Needed for the D4.2 node-level drill-down fetch in the drawer. */
  workspaceSlug: string;
}) {
  const [filter, setFilter] = useState('');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  // D4.2 — node breakdown cache per userId, fetched lazily when a drawer opens.
  const [nodeBreakdown, setNodeBreakdown] = useState<{
    byUser: Map<string, RosterMemberNodesPhase[]>;
    loadingUser: string | null;
    errorUser: string | null;
  }>({ byUser: new Map(), loadingUser: null, errorUser: null });

  const selected = useMemo(
    () => members.find((m) => m.key === selectedKey) ?? null,
    [members, selectedKey],
  );

  useEffect(() => {
    if (!selected) return;
    const userId = selected.userId;
    if (nodeBreakdown.byUser.has(userId) || nodeBreakdown.loadingUser === userId) return;
    let cancelled = false;
    setNodeBreakdown((s) => ({ ...s, loadingUser: userId, errorUser: null }));
    fetch(`/api/workspaces/${workspaceSlug}/roster/${userId}/nodes`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: { phases: RosterMemberNodesPhase[] } = await res.json();
        if (cancelled) return;
        setNodeBreakdown((s) => ({
          ...s,
          byUser: new Map(s.byUser).set(userId, data.phases),
          loadingUser: null,
        }));
      })
      .catch((err) => {
        if (cancelled) return;
        setNodeBreakdown((s) => ({ ...s, loadingUser: null, errorUser: userId }));
        console.error('node breakdown fetch failed', err);
      });
    return () => {
      cancelled = true;
    };
  }, [selected, nodeBreakdown.byUser, nodeBreakdown.loadingUser, workspaceSlug]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) => m.userId.toLowerCase().includes(q) || m.displayName.toLowerCase().includes(q),
    );
  }, [filter, members]);

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
                <th className="px-3 py-3 font-medium">Hoạt động</th>
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
                    colSpan={phases.length + 4}
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
                        <span title={m.userId}>{m.displayName}</span>
                        {m.isOwner && (
                          <span className="rounded-md bg-amber-500/15 text-amber-500 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider">
                            owner
                          </span>
                        )}
                        {m.atRisk && (
                          <span
                            title={`Nguy cơ bỏ cuộc: đã bắt đầu học nhưng không hoạt động ≥ ${AT_RISK_DAYS} ngày và hoàn thành < 100%.`}
                            className="rounded-md bg-amber-500/15 text-amber-500 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider"
                          >
                            at risk
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-xs">
                      <span className="inline-flex items-center rounded-md bg-secondary/60 px-2 py-0.5 text-[10px] font-medium text-foreground/80">
                        {roleLabel(m.role)}
                      </span>
                    </td>
                    <td
                      className="px-3 py-3 text-xs text-muted-foreground"
                      title={
                        m.lastActiveISO
                          ? `Hoạt động gần nhất: ${new Date(m.lastActiveISO).toLocaleString('vi-VN')}`
                          : 'Chưa có ghi nhận hoạt động'
                      }
                    >
                      {formatLastActive(m.lastActiveISO)}
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
                  <span title={selected.userId}>
                    {selected.displayName}
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
                    // D4.2 — node-level rows for this phase (when loaded).
                    const nodePhase = nodeBreakdown.byUser
                      .get(selected.userId)
                      ?.find((np) => np.id === c.phaseId);
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
                              backgroundColor: `rgb(${HEATMAP_RGB})`,
                            }}
                          />
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {c.pct}% complete
                        </div>
                        {nodePhase && nodePhase.nodes.length > 0 && (
                          <ul className="mt-2 space-y-1 border-t border-border pt-2">
                            {nodePhase.nodes.map((n) => (
                              <li
                                key={n.id}
                                className="flex items-center gap-2 text-xs"
                                style={{ paddingLeft: `${Math.min(n.depth, 5) * 12}px` }}
                              >
                                {n.done ? (
                                  <Check className="size-3.5 shrink-0 text-emerald-500" />
                                ) : (
                                  <Circle className="size-3.5 shrink-0 text-muted-foreground/50" />
                                )}
                                <span className="text-[9px] uppercase tracking-wider text-muted-foreground shrink-0">
                                  {n.nodeType}
                                </span>
                                <span
                                  className={
                                    n.done
                                      ? 'text-foreground/60 line-through decoration-foreground/30'
                                      : 'text-foreground'
                                  }
                                >
                                  {n.title}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>

                {nodeBreakdown.loadingUser === selected.userId && (
                  <p className="text-xs text-muted-foreground flex items-center gap-2">
                    <Loader2 className="size-3 animate-spin" /> Loading node breakdown…
                  </p>
                )}
                {nodeBreakdown.errorUser === selected.userId && (
                  <p className="text-xs text-destructive">
                    Could not load node breakdown. Close and reopen the drawer to retry.
                  </p>
                )}

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
