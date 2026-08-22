/**
 * Người học KHÔNG được tự phong `verified` cho kỹ năng của mình.
 *
 * Lỗ hổng đã có thật: `submitEvidence` nhận `kind` là `'manager_review'` từ
 * chính người học, rồi ghi `reviewerUserId = user.id` — người nộp tự đứng tên
 * người duyệt. Sau đó `hasManager && score >= 70` cho ra `shouldVerify`, và
 * `nextLevelSource(prev, 'verify')` đặt `levelSource = 'verified'`. Vì
 * `nextLevelSource` quy định `verified` không sự kiện thường nào hạ được, trạng
 * thái tự phong đó là VĨNH VIỄN.
 *
 * Trong khi đó `verifyEvidence` có chốt `grade.userId !== user.id` kèm chú
 * thích dài: "Cấp bậc không thay thế được sự tách bạch giữa người làm và người
 * duyệt." Chốt ấy bị đi vòng hoàn toàn qua cửa nộp.
 *
 * Test này gác BIÊN đầu vào — chỗ rẻ nhất và chắc nhất. Không đụng DB nên chạy
 * trong `pnpm test` bình thường.
 */
import { describe, it, expect } from 'vitest';
import { z } from 'zod';

/**
 * Bản sao schema `submitInput` trong src/actions/evidence.ts.
 *
 * Không import trực tiếp được vì module đó là `'use server'` và kéo theo cả
 * db/auth. Giữ ở đây đúng một dòng `kind`, và bài test cuối đối chiếu ngược lại
 * với file thật để bản sao này không âm thầm lệch đi.
 */
const submitKind = z.enum(['lab', 'project']);

describe('submitEvidence chỉ nhận dạng bằng chứng tự làm', () => {
  it('nhận lab và project', () => {
    expect(submitKind.safeParse('lab').success).toBe(true);
    expect(submitKind.safeParse('project').success).toBe(true);
  });

  it('TỪ CHỐI manager_review — đây là đường tự phong verified', () => {
    expect(submitKind.safeParse('manager_review').success).toBe(false);
  });

  it('TỪ CHỐI peer_review — người khác đánh giá thì không đi qua form tự nộp', () => {
    expect(submitKind.safeParse('peer_review').success).toBe(false);
  });
});

describe('bản sao schema không được lệch với code thật', () => {
  it('src/actions/evidence.ts vẫn khai đúng enum hai giá trị', async () => {
    const fs = await import('node:fs/promises');
    const src = await fs.readFile('src/actions/evidence.ts', 'utf8');

    // Enum của submitInput — phải là đúng lab + project.
    expect(src).toMatch(/kind:\s*z\.enum\(\['lab',\s*'project'\]\)/);

    // Và không được quay lại ghi người nộp vào ô người duyệt.
    expect(src).not.toMatch(/reviewerUserId:\s*isSelfKind/);
    expect(src).toMatch(/reviewerUserId:\s*null/);
  });

  it('đường lên verified nằm trong verifyEvidence, không nằm trong submitEvidence', async () => {
    const fs = await import('node:fs/promises');
    const src = await fs.readFile('src/actions/evidence.ts', 'utf8');

    const submitStart = src.indexOf('export async function submitEvidence');
    const verifyStart = src.indexOf('export async function verifyEvidence');
    expect(submitStart).toBeGreaterThan(-1);
    expect(verifyStart).toBeGreaterThan(submitStart);

    const submitBody = src.slice(submitStart, verifyStart);
    const verifyBody = src.slice(verifyStart);

    // submitEvidence không được tự suy ra "đã có người duyệt".
    // Nhắm đúng PHÉP GÁN, không phải mọi lần chữ đó xuất hiện — chú thích giải
    // thích lỗ hổng cũ có nhắc tên biến, và đó là điều nên khuyến khích.
    expect(submitBody).not.toMatch(/const\s+hasManager\s*=/);
    expect(submitBody).toMatch(/const\s+shouldVerify\s*=\s*false/);

    // verifyEvidence mới là nơi nâng cấp, và phải giữ chốt cấm tự duyệt.
    expect(verifyBody).toMatch(/CANNOT_VERIFY_OWN_EVIDENCE/);
    expect(verifyBody).toMatch(/nextLevelSource\([^)]*'verify'\)/);
    expect(verifyBody).toMatch(/VERIFIED_MIN_SCORE/);
  });
});
