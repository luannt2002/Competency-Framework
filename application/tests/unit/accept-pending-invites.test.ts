/**
 * acceptPendingInvites (D2.5) — phần pure: guard clause không bao giờ throw
 * và không chạm DB khi thiếu userId/email (đăng nhập không có email, ví dụ
 * OAuth provider không trả email).
 */
import { describe, expect, it } from 'vitest';
import { acceptPendingInvites } from '../../src/lib/auth/join-pending-invites';

describe('acceptPendingInvites guard clauses', () => {
  it('returns [] (no throw) when email is missing', async () => {
    const out = await acceptPendingInvites('00000000-0000-0000-0000-000000000001', null);
    expect(out).toEqual([]);
  });

  it('returns [] (no throw) when email is empty string', async () => {
    const out = await acceptPendingInvites('00000000-0000-0000-0000-000000000001', '');
    expect(out).toEqual([]);
  });

  it('returns [] (no throw) when userId is empty', async () => {
    const out = await acceptPendingInvites('', 'someone@example.com');
    expect(out).toEqual([]);
  });
});
