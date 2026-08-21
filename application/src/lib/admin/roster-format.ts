/**
 * roster-format.ts — PURE formatting/aggregation helpers for the admin roster
 * (D3.6/D3.7 exports, D4.2 drawer). No DB, no React — safe to import from
 * both client components and server actions, and unit-testable.
 */

export const AT_RISK_DAYS = 7;

/** Số ngày từ ISO timestamp đến `now` (làm tròn xuống, dựa trên UTC date). */
export function daysSinceISO(iso: string, now = new Date()): number {
  const DAY_MS = 86_400_000;
  const d = new Date(iso);
  const a = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const b = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((b - a) / DAY_MS);
}

/**
 * D3.3 — định dạng tương đối tiếng Việt cho cột "Hoạt động":
 * hôm nay / hôm qua / "X ngày trước" / "—" (không có dữ liệu).
 */
export function formatLastActive(iso: string | null, now = new Date()): string {
  if (!iso) return '—';
  const days = daysSinceISO(iso, now);
  if (days <= 0) return 'hôm nay';
  if (days === 1) return 'hôm qua';
  return `${days} ngày trước`;
}

/** ISO date (YYYY-MM-DD) for spreadsheets; '—' when unknown. */
export function lastActiveDateISO(iso: string | null): string {
  return iso ? iso.slice(0, 10) : '—';
}

/** Canonical display label for a workspace role. */
export function roleLabel(role: string): string {
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

export type PathNode = { id: string; pathStr: string };

/**
 * Bucket node ids under each top-level phase. A node belongs to a phase when
 * the FIRST segment of its pathStr is the phase id AND it is not the phase
 * itself (matches the roster page semantics — only descendants count).
 */
export function bucketNodesByPhase(
  nodes: PathNode[],
  phaseIds: string[],
): Map<string, string[]> {
  const phases = new Set(phaseIds);
  const out = new Map<string, string[]>();
  for (const pid of phaseIds) out.set(pid, []);
  for (const n of nodes) {
    const rootId = n.pathStr.split('/').filter(Boolean)[0];
    if (rootId && phases.has(rootId) && n.id !== rootId) {
      out.get(rootId)!.push(n.id);
    }
  }
  return out;
}

/** done/total/pct for one phase given the member's done node set. */
export function phaseStats(
  descendantIds: string[],
  doneIds: ReadonlySet<string>,
): { done: number; total: number; pct: number } {
  const done = descendantIds.reduce((acc, id) => (doneIds.has(id) ? acc + 1 : acc), 0);
  const total = descendantIds.length;
  return { done, total, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
}

/** Overall completion % across all phases (0 when nothing to do). */
export function overallPct(perPhase: { done: number; total: number }[]): number {
  const total = perPhase.reduce((a, p) => a + p.total, 0);
  const done = perPhase.reduce((a, p) => a + p.done, 0);
  return total > 0 ? Math.round((done / total) * 100) : 0;
}

/** D3.4 — At Risk: đã bắt đầu VÀ ≥ AT_RISK_DAYS ngày không hoạt động VÀ < 100%. */
export function isAtRisk(input: {
  started: boolean;
  lastActiveISO: string | null;
  overallPct: number;
  now?: Date;
}): boolean {
  if (!input.started || !input.lastActiveISO || input.overallPct >= 100) return false;
  return daysSinceISO(input.lastActiveISO, input.now ?? new Date()) >= AT_RISK_DAYS;
}
