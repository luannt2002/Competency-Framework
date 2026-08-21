/**
 * 6.1 — email obfuscation on public surfaces.
 *
 * `getUserDisplay` falls back to the email local-part when a user has no
 * full_name, which would leak the username half of their email on the
 * public /cert verification page. `toPublicDisplay` must mask that case
 * while leaving real names untouched.
 */
import { describe, expect, it } from 'vitest';
import { obfuscateEmail, toPublicDisplay } from '@/lib/auth/user-display';
import { shortId } from '@/lib/auth/user-display';

describe('obfuscateEmail', () => {
  it('keeps only the first 2 chars of the local part and cloaks @', () => {
    expect(obfuscateEmail('luann.tran@gmail.com')).toBe('lu… [at] gmail.com');
  });

  it('handles garbage input without throwing', () => {
    expect(obfuscateEmail('not-an-email')).toBe(shortId('not-an-email'));
  });
});

describe('toPublicDisplay', () => {
  it('masks displayName that is just the email local-part', () => {
    expect(
      toPublicDisplay({
        id: 'u1',
        displayName: 'luann.tran',
        email: 'luann.tran@gmail.com',
      }),
    ).toEqual({
      id: 'u1',
      displayName: 'lu… [at] gmail.com',
      email: null,
    });
  });

  it('keeps a real full_name but still drops the raw email', () => {
    expect(
      toPublicDisplay({ id: 'u1', displayName: 'Luan Tran', email: 'luann@gmail.com' }),
    ).toEqual({ id: 'u1', displayName: 'Luan Tran', email: null });
  });

  it('leaves the shortId fallback as-is', () => {
    expect(toPublicDisplay({ id: 'u1', displayName: 'u1'.slice(0, 4), email: null })).toEqual({
      id: 'u1',
      displayName: 'u1'.slice(0, 4),
      email: null,
    });
  });
});
