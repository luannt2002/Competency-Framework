/**
 * Unit tests for pure analytics helpers (Flow C5).
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import {
  pct,
  avgPct,
  daysSince,
  isStuckRow,
  stuckScore,
  buildBreadcrumb,
  formatIdleDays,
  STUCK_AFTER_DAYS,
} from '@/lib/analytics/metrics';

const NOW = new Date('2026-08-20T12:00:00Z');

describe('pct', () => {
  it('rounds and handles zero total', () => {
    expect(pct(1, 3)).toBe(33);
    expect(pct(2, 2)).toBe(100);
    expect(pct(0, 0)).toBe(0);
    expect(pct(5, 0)).toBe(0);
    expect(pct(0, -3)).toBe(0);
  });
});

describe('avgPct', () => {
  it('averages and rounds', () => {
    expect(avgPct([10, 20, 30])).toBe(20);
    expect(avgPct([33, 34])).toBe(34);
  });
  it('returns 0 for empty list', () => {
    expect(avgPct([])).toBe(0);
  });
});

describe('daysSince', () => {
  it('floors partial days', () => {
    expect(daysSince(new Date('2026-08-20T00:00:00Z'), NOW)).toBe(0);
    expect(daysSince(new Date('2026-08-13T12:01:00Z'), NOW)).toBe(6);
    expect(daysSince(new Date('2026-08-13T11:59:00Z'), NOW)).toBe(7);
  });
  it('7 full days counts as 7', () => {
    expect(daysSince(new Date('2026-08-13T12:00:00Z'), NOW)).toBe(7);
  });
});

describe('isStuckRow', () => {
  it('done and skipped never stuck', () => {
    const old = new Date('2026-01-01T00:00:00Z');
    expect(isStuckRow('done', old, NOW)).toBe(false);
    expect(isStuckRow('skipped', old, NOW)).toBe(false);
  });
  it('todo/doing before threshold is not stuck', () => {
    expect(isStuckRow('doing', new Date('2026-08-15T00:00:00Z'), NOW)).toBe(false);
  });
  it('exactly 7 days is stuck, 6 days 23h is not', () => {
    expect(isStuckRow('todo', new Date('2026-08-13T12:00:00Z'), NOW)).toBe(true);
    expect(isStuckRow('todo', new Date('2026-08-13T13:00:00Z'), NOW)).toBe(false);
  });
  it('missing timestamp or status defaults safely', () => {
    expect(isStuckRow('todo', null, NOW)).toBe(false);
    expect(isStuckRow(undefined, new Date('2026-01-01T00:00:00Z'), NOW)).toBe(false);
  });
  it('respects custom threshold', () => {
    expect(isStuckRow('doing', new Date('2026-08-19T00:00:00Z'), NOW, 1)).toBe(true);
  });
  it('STUCK_AFTER_DAYS is 7', () => {
    expect(STUCK_AFTER_DAYS).toBe(7);
  });
});

describe('stuckScore', () => {
  it('stuck / started as pct, zero-safe', () => {
    expect(stuckScore(3, 4)).toBe(75);
    expect(stuckScore(0, 10)).toBe(0);
    expect(stuckScore(2, 0)).toBe(0);
  });
});

describe('buildBreadcrumb', () => {
  const titles = new Map([
    ['root', 'DevOps'],
    ['p1', 'Phase 1'],
    ['p2', 'Phase 2'],
    ['w3', 'Week 3'],
    ['n1', 'Docker basics'],
    ['n2', 'K8s ingress'],
  ]);

  it('joins ancestry then self with ›', () => {
    expect(buildBreadcrumb('n1', 'root/p1/w3/n1', titles)).toBe(
      'DevOps › Phase 1 › Week 3 › Docker basics',
    );
  });
  it('falls back to nodeId when nothing known', () => {
    expect(buildBreadcrumb('xyz', '', titles)).toBe('xyz');
  });
  it('skips orphaned segments silently', () => {
    expect(buildBreadcrumb('n1', 'root/ghost/n1', titles)).toBe('DevOps › Docker basics');
  });
  it('truncates long chains keeping head and tail', () => {
    const t = new Map([
      ['a', 'A'],
      ['b', 'B'],
      ['c', 'C'],
      ['d', 'D'],
      ['e', 'E'],
      ['f', 'F'],
    ]);
    // a/b/c/d/e/f with maxSegments 4 → A › … › E › F
    expect(buildBreadcrumb('f', 'a/b/c/d/e/f', t, 4)).toBe('A › … › E › F');
  });
});

describe('formatIdleDays', () => {
  it('formats days, weeks, months', () => {
    expect(formatIdleDays(0)).toBe('0d');
    expect(formatIdleDays(6)).toBe('6d');
    expect(formatIdleDays(7)).toBe('1w');
    expect(formatIdleDays(20)).toBe('2w');
    expect(formatIdleDays(35)).toBe('1mo');
    expect(formatIdleDays(-3)).toBe('0d');
  });
});
