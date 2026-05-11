/**
 * Pure confidence-score math for V8 — no DB / IO. Safe to unit-test.
 *
 * Per spec, confidence is a weighted average of evidence grades (0..100):
 *   lab            : 0.30
 *   project        : 0.40
 *   peer_review    : 0.15
 *   manager_review : 0.15
 *
 * Multiple grades of the same kind are averaged before applying the weight, so a
 * single high-quality lab cannot drown out a poor project score. Missing kinds
 * are simply omitted from the denominator (so a user with only a lab + project
 * is scored against weight 0.7, not 1.0).
 *
 * `source` is derived from what kinds we have:
 *   - any manager_review present AND aggregate score >= 70  -> 'verified'
 *   - any lab/project/peer_review present                   -> 'learned'
 *   - none                                                  -> 'self_claimed'
 */

import type { EvidenceKind } from '@/lib/db/schema-v8';

export type ConfidenceSource = 'self_claimed' | 'learned' | 'verified';

export interface ConfidenceInputGrade {
  kind: EvidenceKind;
  score: number; // 0..100
}

export interface ConfidenceResult {
  score: number; // 0..100, rounded to nearest integer
  source: ConfidenceSource;
}

export const EVIDENCE_WEIGHTS: Readonly<Record<EvidenceKind, number>> = Object.freeze({
  lab: 0.3,
  project: 0.4,
  peer_review: 0.15,
  manager_review: 0.15,
});

/** Verified threshold: at least this aggregate score AND a manager_review present. */
export const VERIFIED_MIN_SCORE = 70;

function clamp01to100(n: number): number {
  if (Number.isNaN(n) || !Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 100) return 100;
  return n;
}

/**
 * Pure: compute aggregate confidence + derived source from a list of grades.
 * No DB, no time, no randomness — deterministic.
 */
export function computeConfidenceFromGrades(
  grades: readonly ConfidenceInputGrade[],
): ConfidenceResult {
  if (grades.length === 0) {
    return { score: 0, source: 'self_claimed' };
  }

  // Group by kind, average within kind so duplicate submissions don't dominate.
  const byKind = new Map<EvidenceKind, number[]>();
  for (const g of grades) {
    const arr = byKind.get(g.kind) ?? [];
    arr.push(clamp01to100(g.score));
    byKind.set(g.kind, arr);
  }

  let weightedSum = 0;
  let totalWeight = 0;
  for (const [kind, scores] of byKind) {
    const w = EVIDENCE_WEIGHTS[kind];
    if (scores.length === 0) continue;
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    weightedSum += avg * w;
    totalWeight += w;
  }

  const score = totalWeight === 0 ? 0 : Math.round(weightedSum / totalWeight);
  const hasManager = (byKind.get('manager_review')?.length ?? 0) > 0;

  let source: ConfidenceSource;
  if (hasManager && score >= VERIFIED_MIN_SCORE) {
    source = 'verified';
  } else {
    source = 'learned';
  }
  return { score, source };
}
