/**
 * generateCertCode — format / uniqueness (G10).
 *
 * 10 ký tự base32 Crockford (không I/L/O/U), url-safe, và đủ khác nhau giữa
 * các lần sinh (không trùng trong 5.000 mẫu).
 */
import { describe, expect, it } from 'vitest';
import {
  CODE_LENGTH,
  generateCertCode,
} from '../../src/lib/db/certificates';

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

describe('generateCertCode', () => {
  it('has the documented length', () => {
    expect(generateCertCode()).toHaveLength(CODE_LENGTH);
    expect(CODE_LENGTH).toBe(10);
  });

  it('uses only url-safe Crockford base32 characters', () => {
    for (let i = 0; i < 500; i++) {
      const code = generateCertCode();
      expect(code).toMatch(/^[0-9A-Z]+$/);
      for (const ch of code) {
        expect(ALPHABET).toContain(ch);
      }
      expect(code).not.toMatch(/[ILOU]/);
    }
  });

  it('does not collide across a large sample', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 5000; i++) {
      const code = generateCertCode();
      expect(seen.has(code)).toBe(false);
      seen.add(code);
    }
  });
});
