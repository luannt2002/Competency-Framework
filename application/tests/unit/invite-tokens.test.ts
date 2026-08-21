/**
 * Invite tokens (D2.5) — pure parts: format / uniqueness của token sinh ra
 * cho workspace_invites, và chuẩn hoá email dùng khi so khớp invite pending
 * với email người dùng đăng nhập.
 */
import { describe, expect, it } from 'vitest';
import {
  INVITE_TOKEN_ALPHABET,
  INVITE_TOKEN_LENGTH,
  generateInviteToken,
  normalizeEmail,
} from '../../src/lib/auth/invite-tokens';

describe('generateInviteToken', () => {
  it('has the documented length', () => {
    expect(generateInviteToken()).toHaveLength(INVITE_TOKEN_LENGTH);
    expect(INVITE_TOKEN_LENGTH).toBe(16);
  });

  it('uses only url-safe Crockford base32 characters', () => {
    for (let i = 0; i < 500; i++) {
      const token = generateInviteToken();
      expect(token).toMatch(/^[0-9A-Z]+$/);
      for (const ch of token) {
        expect(INVITE_TOKEN_ALPHABET).toContain(ch);
      }
      expect(token).not.toMatch(/[ILOU]/);
    }
  });

  it('does not collide across a large sample', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 10000; i++) {
      const token = generateInviteToken();
      expect(seen.has(token)).toBe(false);
      seen.add(token);
    }
  });
});

describe('normalizeEmail', () => {
  it('trims and lowercases so login emails match stored invites', () => {
    expect(normalizeEmail('  Alice@Example.COM ')).toBe('alice@example.com');
  });

  it('is stable (idempotent)', () => {
    const once = normalizeEmail('Bob@Corp.io');
    expect(normalizeEmail(once)).toBe(once);
  });
});
