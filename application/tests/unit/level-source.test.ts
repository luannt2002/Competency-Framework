import { describe, it, expect } from 'vitest';
import { nextLevelSource, type LevelSource } from '@/lib/skills/level-source';

const ALL: Array<LevelSource | null> = [null, 'self_claimed', 'learned', 'both', 'verified'];

describe('nextLevelSource', () => {
  it('duyệt luôn thắng, từ bất kỳ trạng thái nào', () => {
    for (const prev of ALL) expect(nextLevelSource(prev, 'verify')).toBe('verified');
  });

  it('KHÔNG sự kiện thường nào hạ cấp verified (lỗi B6.4)', () => {
    expect(nextLevelSource('verified', 'self_assess')).toBe('verified');
    expect(nextLevelSource('verified', 'learn')).toBe('verified');
  });

  it('tự đánh giá', () => {
    expect(nextLevelSource(null, 'self_assess')).toBe('self_claimed');
    expect(nextLevelSource('self_claimed', 'self_assess')).toBe('self_claimed');
    expect(nextLevelSource('learned', 'self_assess')).toBe('both');
    expect(nextLevelSource('both', 'self_assess')).toBe('both');
  });

  it('học xong', () => {
    expect(nextLevelSource(null, 'learn')).toBe('learned');
    expect(nextLevelSource('learned', 'learn')).toBe('learned');
    expect(nextLevelSource('self_claimed', 'learn')).toBe('both');
    expect(nextLevelSource('both', 'learn')).toBe('both');
  });

  it('both không bao giờ tụt về một vế', () => {
    expect(nextLevelSource('both', 'self_assess')).toBe('both');
    expect(nextLevelSource('both', 'learn')).toBe('both');
  });

  it('đơn điệu: áp cùng một sự kiện hai lần cho kết quả như nhau', () => {
    for (const prev of ALL) {
      for (const ev of ['self_assess', 'learn', 'verify'] as const) {
        const once = nextLevelSource(prev, ev);
        expect(nextLevelSource(once, ev)).toBe(once);
      }
    }
  });
});
