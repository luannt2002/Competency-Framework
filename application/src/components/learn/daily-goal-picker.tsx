'use client';

/**
 * Đổi mục tiêu XP mỗi ngày — ghi vào DB, không phải localStorage.
 *
 * Vì sao nó nằm ở đây chứ không ở /settings: `user_planner_settings` khoá theo
 * (workspace, user), mà /settings là trang TOÀN CỤC nên không có workspace nào
 * để ghi vào. Trước đợt này /settings có một bộ nút "Daily XP goal" ghi
 * `localStorage['pref:daily-goal']` — không nơi nào đọc key đó, nên mục tiêu
 * của mọi người dùng kẹt vĩnh viễn ở mặc định 60: có nút bấm nhưng nút không
 * nối vào đâu, còn `updatePlannerSettings` (đường thật, đã validate sẵn) thì
 * không có UI nào gọi.
 *
 * Cập nhật lạc quan: đổi số hiện ra ngay rồi mới gọi server, hỏng thì trả về
 * giá trị cũ. Đây là thao tác một chạm, chờ round-trip mới thấy đổi là cảm giác
 * nút bị kẹt.
 */
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { updatePlannerSettings } from '@/actions/daily-planner';
import { isNextControlFlowError } from '@/lib/is-redirect-error';
import { DAILY_GOAL_PRESETS } from '@/lib/learn/xp-rules';
import { cn } from '@/lib/utils';

export function DailyGoalPicker({
  workspaceSlug,
  currentGoal,
}: {
  workspaceSlug: string;
  currentGoal: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [goal, setGoal] = useState(currentGoal);

  function pick(next: number) {
    if (next === goal || pending) return;
    const previous = goal;
    setGoal(next);

    startTransition(async () => {
      try {
        await updatePlannerSettings({ workspaceSlug, dailyGoalXp: next });
        toast.success(`Mục tiêu mỗi ngày: ${next} XP`);
        router.refresh();
      } catch (e) {
        if (isNextControlFlowError(e)) throw e;
        setGoal(previous);
        toast.error('Không đổi được mục tiêu', {
          description: e instanceof Error ? e.message : 'Thử lại sau.',
        });
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 pt-1">
      <span className="text-xs text-muted-foreground">Đổi mục tiêu:</span>
      {DAILY_GOAL_PRESETS.map((o) => (
        <button
          key={o.xp}
          type="button"
          onClick={() => pick(o.xp)}
          disabled={pending}
          aria-pressed={goal === o.xp}
          className={cn(
            'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            'disabled:opacity-60',
            goal === o.xp
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border text-muted-foreground hover:text-foreground',
          )}
        >
          {o.xp} XP · {o.label}
        </button>
      ))}
    </div>
  );
}
