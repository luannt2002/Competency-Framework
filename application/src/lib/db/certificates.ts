/**
 * certificates.ts — sinh mã xác thực + upsert dòng chứng nhận (G8/G10/G12).
 *
 * `generateCertCode`: base32 (Crockford, bỏ dễ nhầm I/L/O/U) từ crypto
 * random — không thêm dependency. 10 ký tự ≈ 50 bit entropy, đủ để mã là
 * bí mật cho route công khai /cert/[code].
 *
 * `issueCertificate`: upsert theo (workspaceId, subjectUserId). Tái xem
 * cập nhật pct/doneCount/totalNodes nhưng GIỮ issued_at cũ (ngày cấp đầu)
 * và không đổi unique_code (QR in sẵn không bị vô hiệu).
 */
import { randomBytes } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { db } from './client';
import { certificates } from './schema-certificates';

const CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // 32 ký tự
export const CODE_LENGTH = 10;

/** Sinh mã chứng nhận url-safe, ví dụ `7Q4JB9XK2M`. */
export function generateCertCode(): string {
  const bytes = randomBytes(CODE_LENGTH);
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length] ?? '0';
  }
  return out;
}

export type IssuedCertificate = {
  id: string;
  uniqueCode: string;
  issuedAt: Date;
  /** Khác null = đã thu hồi: không được in, không được cấp lại. */
  revokedAt: Date | null;
};

/**
 * Upsert chứng nhận cho một subject đủ điều kiện trong một workspace.
 * Trả về dòng sau upsert (code + issuedAt gốc).
 */
export async function issueCertificate(input: {
  workspaceId: string;
  subjectUserId: string;
  pct: number;
  doneCount: number;
  totalNodes: number;
}): Promise<IssuedCertificate> {
  const existing = await db
    .select()
    .from(certificates)
    .where(
      and(
        eq(certificates.workspaceId, input.workspaceId),
        eq(certificates.subjectUserId, input.subjectUserId),
      ),
    )
    .limit(1);

  if (existing[0]) {
    // Re-view: refresh metrics, keep the ORIGINAL issuedAt + uniqueCode.
    const row = existing[0];
    await db
      .update(certificates)
      .set({
        pct: input.pct,
        doneCount: input.doneCount,
        totalNodes: input.totalNodes,
      })
      .where(
        and(
          eq(certificates.id, row.id),
          eq(certificates.workspaceId, input.workspaceId),
        ),
      );
    return {
      id: row.id,
      uniqueCode: row.uniqueCode,
      issuedAt: row.issuedAt,
      revokedAt: row.revokedAt,
    };
  }

  // First issue. Loop retry phòng hụt hit độ hiếm của unique_code collision.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const inserted = await db
        .insert(certificates)
        .values({
          workspaceId: input.workspaceId,
          subjectUserId: input.subjectUserId,
          pct: input.pct,
          doneCount: input.doneCount,
          totalNodes: input.totalNodes,
          issuedAt: new Date(),
          uniqueCode: generateCertCode(),
        })
        .returning({
          id: certificates.id,
          uniqueCode: certificates.uniqueCode,
          issuedAt: certificates.issuedAt,
          revokedAt: certificates.revokedAt,
        });
      if (inserted[0]) return inserted[0];
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (!msg.includes('certificates_unique_code_uq')) throw err;
      // collision on the random code — retry with a fresh code
    }
  }
  throw new Error('issueCertificate: failed to allocate unique code');
}
