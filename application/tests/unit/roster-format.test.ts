/**
 * Unit tests for pure roster helpers (D3.6/D3.7/D4.2 support).
 * See src/lib/admin/roster-format.ts.
 */
import { describe, expect, it } from 'vitest';
import {
  AT_RISK_DAYS,
  bucketNodesByPhase,
  daysSinceISO,
  formatLastActive,
  isAtRisk,
  lastActiveDateISO,
  overallPct,
  phaseStats,
  roleLabel,
} from '@/lib/admin/roster-format';

describe('daysSinceISO / formatLastActive', () => {
  const now = new Date('2026-08-20T12:00:00Z');
  it('0 days today, 1 day yesterday', () => {
    expect(daysSinceISO('2026-08-20T01:00:00Z', now)).toBe(0);
    expect(daysSinceISO('2026-08-19T23:00:00Z', now)).toBe(1);
  });
  it('formats relative Vietnamese labels', () => {
    expect(formatLastActive(null, now)).toBe('—');
    expect(formatLastActive('2026-08-20T00:00:00Z', now)).toBe('hôm nay');
    expect(formatLastActive('2026-08-19T00:00:00Z', now)).toBe('hôm qua');
    expect(formatLastActive('2026-08-13T00:00:00Z', now)).toBe('7 ngày trước');
  });
  it('ISO date column value', () => {
    expect(lastActiveDateISO('2026-08-19T23:00:00.123Z')).toBe('2026-08-19');
    expect(lastActiveDateISO(null)).toBe('—');
  });
});

describe('roleLabel', () => {
  it('maps canonical roles, passes through unknown', () => {
    expect(roleLabel('workspace_owner')).toBe('Owner');
    expect(roleLabel('learner')).toBe('Learner');
    expect(roleLabel('custom_role')).toBe('custom_role');
  });
});

describe('bucketNodesByPhase', () => {
  it('buckets descendants by first pathStr segment, excluding the phase itself', () => {
    const nodes = [
      { id: 'phase1', pathStr: '/phase1' },
      { id: 'a', pathStr: '/phase1/a' },
      { id: 'b', pathStr: '/phase1/a/b' },
      { id: 'c', pathStr: '/phase2/c' },
      { id: 'orphan', pathStr: '/other/x' },
    ];
    const buckets = bucketNodesByPhase(nodes, ['phase1', 'phase2']);
    expect(buckets.get('phase1')).toEqual(['a', 'b']);
    expect(buckets.get('phase2')).toEqual(['c']);
  });
  it('empty phase list yields empty map entries', () => {
    const buckets = bucketNodesByPhase([], []);
    expect(buckets.size).toBe(0);
  });
});

describe('phaseStats / overallPct', () => {
  it('counts done vs total and rounds pct', () => {
    const done = new Set(['n1', 'n3']);
    expect(phaseStats(['n1', 'n2', 'n3'], done)).toEqual({ done: 2, total: 3, pct: 67 });
    expect(phaseStats([], done)).toEqual({ done: 0, total: 0, pct: 0 });
  });
  it('overall pct across phases; 0 when nothing to do', () => {
    expect(overallPct([{ done: 1, total: 2 }, { done: 1, total: 2 }])).toBe(50);
    expect(overallPct([{ done: 0, total: 0 }])).toBe(0);
  });
});

describe('isAtRisk (D3.4)', () => {
  const now = new Date('2026-08-20T00:00:00Z');
  it('requires started + inactive >= AT_RISK_DAYS + incomplete', () => {
    const base = { started: true, lastActiveISO: '2026-08-13T00:00:00Z', overallPct: 40, now };
    expect(isAtRisk(base)).toBe(true);
    expect(isAtRisk({ ...base, started: false })).toBe(false);
    expect(isAtRisk({ ...base, lastActiveISO: '2026-08-19T00:00:00Z' })).toBe(false);
    expect(isAtRisk({ ...base, overallPct: 100 })).toBe(false);
    expect(isAtRisk({ ...base, lastActiveISO: null })).toBe(false);
  });
  it('boundary: exactly AT_RISK_DAYS inactive is at risk', () => {
    expect(
      isAtRisk({
        started: true,
        lastActiveISO: `2026-08-${20 - AT_RISK_DAYS}T00:00:00Z`,
        overallPct: 10,
        now,
      }),
    ).toBe(true);
  });
});
