/**
 * invite-tokens.ts — sinh mã token cho workspace_invites (D2.5).
 *
 * Cùng style với `generateCertCode` trong `src/lib/db/certificates.ts`:
 * base32 Crockford (bỏ I/L/O/U dễ nhầm) từ crypto random, url-safe, không
 * thêm dependency. Tách file riêng (thay vì import certificates.ts) để phần
 * pure dễ unit-test và không kéo theo db client.
 */
import { randomBytes } from 'node:crypto';

export const INVITE_TOKEN_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // 32 ký tự
export const INVITE_TOKEN_LENGTH = 16;

/**
 * Chuẩn hoá email invite: trim + lowercase để so khớp với email người dùng
 * đăng nhập (Supabase email có thể khác case).
 */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Sinh invite token url-safe, ví dụ `7Q4JB9XK2M4T8V6R`. */
export function generateInviteToken(): string {
  const bytes = randomBytes(INVITE_TOKEN_LENGTH);
  let out = '';
  for (let i = 0; i < INVITE_TOKEN_LENGTH; i++) {
    out += INVITE_TOKEN_ALPHABET[bytes[i]! % INVITE_TOKEN_ALPHABET.length] ?? '0';
  }
  return out;
}
