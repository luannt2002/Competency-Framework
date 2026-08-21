/**
 * F18 — crown tint picks the strongest level_source:
 * verified (gold) > learned/both (primary/blue) > self_claimed (muted).
 * F5 — skill verified pays a one-off +30 XP constant.
 */

import { describe, it, expect } from 'vitest';
import { crownToneClass } from '../../src/components/skills/crown-count';
import { XP } from '../../src/lib/learn/xp-rules';

describe('crownToneClass (F18)', () => {
  it('verified → gold', () => {
    expect(crownToneClass('verified')).toBe('text-yellow-500');
  });

  it('learned and both (self+learned mix) → primary', () => {
    expect(crownToneClass('learned')).toBe('text-primary');
    expect(crownToneClass('both')).toBe('text-primary');
  });

  it('self_claimed, null and undefined → muted', () => {
    expect(crownToneClass('self_claimed')).toBe('text-muted-foreground');
    expect(crownToneClass(null)).toBe('text-muted-foreground');
    expect(crownToneClass(undefined)).toBe('text-muted-foreground');
  });
});

describe('XP.SKILL_VERIFIED (F5)', () => {
  it('is 30, one-off per skill+user on evidence approval', () => {
    expect(XP.SKILL_VERIFIED).toBe(30);
  });
});
