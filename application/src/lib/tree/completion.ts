/**
 * Pure completion-math helpers (audit 7.11 / A4 + A6).
 *
 * Kept free of DB imports so they're unit-testable — the share page feeds
 * them the grouped counts from user_node_progress.
 */

/** Percent of `done` out of `total`, rounded, clamped to [0, 100]. Returns 0 when total <= 0. */
export function completionPct(done: number, total: number): number {
  if (!Number.isFinite(done) || !Number.isFinite(total) || total <= 0) return 0;
  const pct = (done / total) * 100;
  return Math.min(100, Math.max(0, Math.round(pct)));
}

/**
 * Average completion % across a set of learners.
 *
 * @param doneCounts one entry per learner (users with ANY progress rows in the
 *   workspace) — each value is that learner's count of `done` nodes.
 * @param totalNodes total nodes in the roadmap tree (denominator per learner).
 * @returns the mean of per-learner `completionPct`, rounded. 0 when there are
 *   no learners or no nodes.
 */
export function averageCompletionPct(doneCounts: number[], totalNodes: number): number {
  if (doneCounts.length === 0 || totalNodes <= 0) return 0;
  const sum = doneCounts.reduce((acc, d) => acc + completionPct(d, totalNodes), 0);
  return Math.round(sum / doneCounts.length);
}
