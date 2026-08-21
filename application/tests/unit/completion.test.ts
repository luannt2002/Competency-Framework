import { describe, expect, it } from 'vitest';
import { averageCompletionPct, completionPct } from '@/lib/tree/completion';

describe('completionPct (audit 7.11 / A4 + A6)', () => {
  it('computes rounded percentage', () => {
    expect(completionPct(5, 10)).toBe(50);
    expect(completionPct(1, 3)).toBe(33);
    expect(completionPct(2, 3)).toBe(67);
    expect(completionPct(10, 10)).toBe(100);
  });

  it('returns 0 for empty or invalid totals', () => {
    expect(completionPct(3, 0)).toBe(0);
    expect(completionPct(3, -1)).toBe(0);
    expect(completionPct(NaN, 10)).toBe(0);
  });

  it('clamps out-of-range done counts', () => {
    expect(completionPct(11, 10)).toBe(100);
    expect(completionPct(-2, 10)).toBe(0);
  });
});

describe('averageCompletionPct', () => {
  it('averages per-learner completion', () => {
    // 2 learners over 10 nodes: 5 done (50%) and 10 done (100%) → 75%
    expect(averageCompletionPct([5, 10], 10)).toBe(75);
  });

  it('rounds the mean (not each learner first vs after)', () => {
    // 3 nodes: 1/3=33%, 2/3=67%, 2/3=67% → mean 55.67 → 56
    expect(averageCompletionPct([1, 2, 2], 3)).toBe(56);
  });

  it('returns 0 with no learners or no nodes', () => {
    expect(averageCompletionPct([], 10)).toBe(0);
    expect(averageCompletionPct([3, 4], 0)).toBe(0);
  });
});
