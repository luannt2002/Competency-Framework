/**
 * Unit tests — F16 badge rule-form validation (pure logic, no DB).
 * File: src/lib/badges/rule-form.ts
 */
import { describe, it, expect } from 'vitest';
import {
  validateRuleForm,
  describeRule,
  slugifyBadgeName,
  EMPTY_RULE_FORM,
  RULE_KINDS,
  BADGE_ICON_KEYS,
  type RuleFormValues,
} from '@/lib/badges/rule-form';

function form(over: Partial<RuleFormValues>): RuleFormValues {
  return { ...EMPTY_RULE_FORM, ...over };
}

describe('validateRuleForm — numeric kinds', () => {
  const numericKinds = [
    'lesson_completed',
    'week_completed',
    'streak',
    'crowns_total',
    'total_xp',
  ] as const;

  it.each([...numericKinds])('accepts a positive integer for %s', (kind) => {
    const res = validateRuleForm(form({ kind, value: '5' }));
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.rule).toEqual({ kind, value: 5 });
  });

  it.each([...numericKinds])('rejects 0, negatives, decimals and junk for %s', (kind) => {
    for (const bad of ['0', '-3', '2.5', 'abc', '', '  ', '1e3', '9999999']) {
      const res = validateRuleForm(form({ kind, value: bad }));
      expect(res.ok).toBe(false);
    }
  });

  it('trims whitespace around a numeric value', () => {
    const res = validateRuleForm(form({ kind: 'streak', value: ' 7 ' }));
    expect(res.ok && res.rule).toEqual({ kind: 'streak', value: 7 });
  });
});

describe('validateRuleForm — level_completed', () => {
  it('accepts a level code and trims it', () => {
    const res = validateRuleForm(form({ kind: 'level_completed', value: ' l ' }));
    expect(res.ok && res.rule).toEqual({ kind: 'level_completed', value: 'l' });
  });

  it('rejects empty or oversized codes', () => {
    expect(validateRuleForm(form({ kind: 'level_completed', value: '' })).ok).toBe(false);
    expect(
      validateRuleForm(form({ kind: 'level_completed', value: 'x'.repeat(41) })).ok,
    ).toBe(false);
  });
});

describe('validateRuleForm — category_level', () => {
  it('accepts category + level pair', () => {
    const res = validateRuleForm(
      form({ kind: 'category_level', category: 'devops', level: 'M' }),
    );
    expect(res.ok && res.rule).toEqual({
      kind: 'category_level',
      category: 'devops',
      level: 'M',
    });
  });

  it('reports BOTH missing fields at once', () => {
    const res = validateRuleForm(form({ kind: 'category_level' }));
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors.category).toBeTruthy();
      expect(res.errors.level).toBeTruthy();
    }
  });

  it('rejects a valid category with a missing level only', () => {
    const res = validateRuleForm(form({ kind: 'category_level', category: 'devops' }));
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors.category).toBeUndefined();
      expect(res.errors.level).toBeTruthy();
    }
  });
});

describe('validateRuleForm — all_skills_assessed', () => {
  it('needs no extra fields and ignores stray input', () => {
    const res = validateRuleForm(
      form({ kind: 'all_skills_assessed', value: 'garbage', category: 'x', level: 'y' }),
    );
    expect(res.ok && res.rule).toEqual({ kind: 'all_skills_assessed' });
  });
});

describe('validateRuleForm — unknown kind', () => {
  it('fails cleanly', () => {
    // @ts-expect-error intentionally invalid kind
    const res = validateRuleForm(form({ kind: 'nope' }));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.kind).toBeTruthy();
  });
});

describe('catalogue integrity', () => {
  it('covers exactly the 8 evaluator kinds', () => {
    expect([...RULE_KINDS].sort()).toEqual(
      [
        'all_skills_assessed',
        'category_level',
        'crowns_total',
        'lesson_completed',
        'level_completed',
        'streak',
        'total_xp',
        'week_completed',
      ].sort(),
    );
  });

  it('matches BADGE_ICONS keys from badge-wall.tsx', () => {
    expect([...BADGE_ICON_KEYS].sort()).toEqual(
      [
        'Award',
        'CalendarCheck',
        'Cloud',
        'Crown',
        'Flame',
        'Footprints',
        'Grid3x3',
        'Medal',
        'Sparkles',
        'Star',
        'Trophy',
        'Zap',
      ].sort(),
    );
  });
});

describe('describeRule', () => {
  it('summarises each kind without throwing', () => {
    for (const rule of [
      { kind: 'lesson_completed', value: 10 },
      { kind: 'week_completed', value: 4 },
      { kind: 'level_completed', value: 'l' },
      { kind: 'streak', value: 3 },
      { kind: 'crowns_total', value: 50 },
      { kind: 'category_level', category: 'devops', level: 'm' },
      { kind: 'all_skills_assessed' },
      { kind: 'total_xp', value: 1000 },
    ]) {
      expect(typeof describeRule(rule)).toBe('string');
      expect(describeRule(rule)).not.toBe('—');
    }
  });

  it('degrades gracefully on null/garbage', () => {
    expect(describeRule(null)).toBe('—');
    expect(describeRule('x')).toBe('—');
    expect(describeRule({ kind: '???', value: 1 })).toBe('—');
  });
});

describe('slugifyBadgeName', () => {
  it('strips diacritics, lowercases, dash-joins', () => {
    expect(slugifyBadgeName('Chuyên gia DevOps!')).toBe('chuyen-gia-devops');
    expect(slugifyBadgeName('Đ Diligent Learner ')).toBe('d-diligent-learner');
  });

  it('never returns empty', () => {
    expect(slugifyBadgeName('???')).toBe('badge');
    expect(slugifyBadgeName('')).toBe('badge');
  });

  it('caps length at 60', () => {
    expect(slugifyBadgeName('a'.repeat(100)).length).toBeLessThanOrEqual(60);
  });
});
