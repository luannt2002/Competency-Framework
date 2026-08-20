/**
 * Date helpers for the daily planner — pure functions, no DB, unit-testable.
 * All dates are ISO yyyy-mm-dd strings in UTC (server convention).
 */

/** Format a Date as ISO date (yyyy-mm-dd) in UTC. */
export function isoDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayISO(): string {
  return isoDate(new Date());
}

export function tomorrowISO(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  return isoDate(d);
}

/** Days between two ISO date strings (positive => `b` is after `a`). */
export function daysBetween(aIso: string | null, bIso: string): number {
  if (!aIso) return Number.POSITIVE_INFINITY;
  const a = new Date(`${aIso}T00:00:00Z`).getTime();
  const b = new Date(`${bIso}T00:00:00Z`).getTime();
  return Math.floor((b - a) / 86_400_000);
}
