/**
 * Không bày ra công tắc không nối vào đâu.
 *
 * `/settings` từng có 4 tuỳ chọn ghi `localStorage['pref:*']` mà rà toàn `src/`
 * ra 0 nơi đọc: sound, reduced-motion, language, daily XP goal. Người dùng bấm,
 * thấy toast "đã lưu", rồi không gì thay đổi.
 *
 * Riêng daily XP goal còn tệ hơn: đường THẬT đã dựng sẵn và hoạt động
 * (`user_planner_settings.dailyGoalXp` + `updatePlannerSettings`, đã validate),
 * chỉ là không UI nào gọi — nên mục tiêu của mọi người dùng kẹt ở mặc định 60.
 * Có nút bấm thì nút không nối vào đâu; có đường thật thì đường không có nút.
 *
 * Hai bài đầu gác việc GỠ, bài cuối gác việc NỐI — thiếu bài cuối thì ai đó gỡ
 * nốt `DailyGoalPicker` là quay lại đúng trạng thái cũ mà test vẫn xanh.
 */
import { describe, it, expect } from 'vitest';

async function readSrc(rel: string): Promise<string> {
  const fs = await import('node:fs/promises');
  return fs.readFile(rel, 'utf8');
}

/** Bỏ dòng chú thích: chú thích giải thích lỗi cũ có nhắc tên các key. */
function codeOnly(src: string): string {
  return src
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l))
    .join('\n');
}

describe('settings-form không còn tuỳ chọn chết', () => {
  it('không ghi key pref:* nào nữa', async () => {
    const code = codeOnly(await readSrc('src/components/settings/settings-form.tsx'));
    expect(code).not.toMatch(/localStorage\.setItem/);
    expect(code).not.toMatch(/'pref:/);
  });

  it('không còn bộ chọn Daily XP goal ở trang toàn cục', async () => {
    // Bảng `user_planner_settings` khoá theo (workspace, user); trang /settings
    // là toàn cục nên không có workspace nào để ghi vào.
    const code = codeOnly(await readSrc('src/components/settings/settings-form.tsx'));
    expect(code).not.toMatch(/GOAL_OPTIONS/);
    expect(code).not.toMatch(/Daily XP goal/);
  });
});

describe('không key pref:* nào bị bỏ lại rải rác trong src/', () => {
  it('toàn bộ src/ sạch', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');

    async function walk(dir: string, out: string[] = []): Promise<string[]> {
      for (const name of await fs.readdir(dir)) {
        const full = path.join(dir, name);
        if ((await fs.stat(full)).isDirectory()) await walk(full, out);
        else if (/\.tsx?$/.test(full)) out.push(full);
      }
      return out;
    }

    const viPham: string[] = [];
    for (const file of await walk('src')) {
      const code = codeOnly(await fs.readFile(file, 'utf8'));
      if (/'pref:(sound|reduced-motion|daily-goal|lang)'/.test(code)) viPham.push(file);
    }
    expect(viPham, `còn key pref:* chết: ${viPham.join(', ')}`).toEqual([]);
  });
});

describe('mục tiêu XP mỗi ngày đã nối vào đường thật', () => {
  it('DailyGoalPicker gọi updatePlannerSettings, không đụng localStorage', async () => {
    const src = await readSrc('src/components/learn/daily-goal-picker.tsx');
    const code = codeOnly(src);

    expect(code).toMatch(/updatePlannerSettings\(/);
    expect(code).toMatch(/dailyGoalXp:/);
    expect(code).not.toMatch(/localStorage/);

    // Các mốc XP là số nghiệp vụ nên phải lấy từ xp-rules, không rải trong
    // component — `guard-no-hardcode` bắt đúng chuyện này.
    expect(code).toMatch(/DAILY_GOAL_PRESETS/);
    expect(code).not.toMatch(/xp:\s*\d+/);

    // Redirect/notFound không được nuốt trong catch.
    expect(code).toMatch(/isNextControlFlowError/);
  });

  it('trang /daily có render bộ chọn, kèm workspaceSlug và giá trị hiện tại', async () => {
    const code = codeOnly(await readSrc('src/app/(app)/w/[slug]/daily/page.tsx'));
    expect(code).toMatch(/<DailyGoalPicker/);
    expect(code).toMatch(/workspaceSlug=\{slug\}/);
    expect(code).toMatch(/currentGoal=\{view\.dailyGoalXp\}/);
  });

  it('updatePlannerSettings vẫn nhận dailyGoalXp và có chốt quyền', async () => {
    const code = codeOnly(await readSrc('src/actions/daily-planner.ts'));
    expect(code).toMatch(/dailyGoalXp:\s*z\.number\(\)/);

    const start = code.indexOf('export async function updatePlannerSettings');
    expect(start).toBeGreaterThan(-1);
    const body = code.slice(start, start + 1500);
    expect(body).toMatch(/resolveWorkspace|requireUser/);
  });
});
