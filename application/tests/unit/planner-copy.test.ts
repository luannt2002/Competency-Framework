import { describe, it, expect } from 'vitest';
import { planDay, type UserContext } from '@/lib/learn/daily-planner';

/**
 * Tiêu đề và mô tả task được GHI VÀO `daily_tasks`, nên chúng là dữ liệu, không
 * phải chữ trên màn hình. Hai thứ từng lọt xuống DB rồi ra thẳng mặt người dùng:
 *   - chuỗi tiếng Anh ("Keep your streak alive") giữa app khai lang="vi"
 *   - giá trị canh 999 ("Weak skill (unset) — 999d since last touch")
 */
const baseCtx = (over: Partial<UserContext> = {}): UserContext => ({
  currentWeek: null,
  unfinishedLessons: [],
  unfinishedLabs: [],
  weakSkills: [],
  yesterdayExercise: null,
  streakAtRisk: false,
  unfinishedNodes: [],
  ...over,
});

const plan = (ctx: UserContext) => planDay({ userContext: ctx });

describe('chữ trong kế hoạch ngày', () => {
  it('kỹ năng chưa từng ôn: nói "chưa từng ôn", không in 999', () => {
    const tasks = plan(
      baseCtx({
        weakSkills: [
          { id: 's1', name: 'Kubernetes', levelCode: null, daysSinceTouched: 999 },
        ],
      }),
    );
    const text = tasks.map((t) => `${t.title} ${t.description ?? ''}`).join(' | ');
    expect(text).not.toMatch(/999/);
    expect(text).toContain('chưa từng ôn');
  });

  it('kỹ năng có ngày cụ thể thì nói số ngày', () => {
    const tasks = plan(
      baseCtx({
        weakSkills: [{ id: 's1', name: 'Terraform', levelCode: 'XS', daysSinceTouched: 12 }],
      }),
    );
    const text = tasks.map((t) => t.description ?? '').join(' | ');
    expect(text).toContain('12 ngày chưa ôn');
  });

  it('không còn chuỗi tiếng Anh nào lọt vào dữ liệu ghi ra DB', () => {
    const tasks = plan(
      baseCtx({
        weakSkills: [{ id: 's1', name: 'Go', levelCode: 'XS', daysSinceTouched: 3 }],
        yesterdayExercise: { exerciseId: 'e1', promptShort: 'Viết Dockerfile' },
        unfinishedNodes: [
          {
            id: 'n1',
            title: 'Node A',
            slug: 'node-a',
            nodeType: 'lesson',
            estMinutes: 5,
            inProgress: false,
          },
        ],
      }),
    );
    const text = tasks.map((t) => `${t.title} ${t.description ?? ''}`).join(' | ');
    for (const eng of [
      'Keep your streak',
      'Replay yesterday',
      'Quick replay',
      'Weak skill',
      'since last touch',
      'Stretch:',
      'Review:',
      'Hands-on',
      'Carryover',
      'Continue ',
    ]) {
      expect(text, `còn sót: ${eng}`).not.toContain(eng);
    }
  });
});
