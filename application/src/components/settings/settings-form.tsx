'use client';

/**
 * Trang cài đặt cá nhân — CHỈ giữ những gì thật sự có tác dụng.
 *
 * Trước đợt này ở đây có 4 tuỳ chọn ghi `localStorage['pref:*']` mà rà toàn
 * `src/` ra 0 nơi đọc: sound, reduced-motion, language, và daily XP goal.
 * Người dùng bấm, thấy toast "đã lưu", rồi không gì thay đổi.
 *
 * Đã xử lý:
 *  - sound / reduced-motion / language: GỠ. Không có tính năng nào phía sau —
 *    chính file này từng tự ghi "UI labels only (MVP)" cho phần ngôn ngữ. Bày
 *    ra một công tắc không nối vào đâu tệ hơn là không bày.
 *  - daily XP goal: CHUYỂN sang /w/[slug]/daily. Nó có đường thật đã dựng sẵn
 *    (`user_planner_settings.dailyGoalXp` + `updatePlannerSettings`) nhưng
 *    không UI nào gọi, nên mục tiêu của mọi người kẹt ở mặc định 60. Bảng đó
 *    khoá theo (workspace, user) mà trang này là TOÀN CỤC nên không có
 *    workspace để ghi vào — chỗ đúng của nó là trang Hôm nay.
 *
 * Còn lại đây: theme (next-themes, có tác dụng thật).
 */
import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import { Moon, Sun } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

export function SettingsForm() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // `next-themes` chỉ biết theme thật sau khi mount; render trước đó sẽ lệch
  // giữa server và client.
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className="surface p-6 animate-pulse h-48" />;
  }

  return (
    <div className="space-y-4">
      {/* Theme */}
      <Row
        icon={theme === 'dark' ? Moon : Sun}
        label="Dark mode"
        description="Switch between dark (recommended) and light theme."
        action={
          <Switch
            checked={theme === 'dark'}
            onCheckedChange={(v) => {
              setTheme(v ? 'dark' : 'light');
              toast.success(v ? 'Dark mode on' : 'Light mode on');
            }}
          />
        }
      />

      {/* Sound / Reduced motion / Language / Daily goal đã gỡ — xem chú thích
          đầu file. Mục tiêu XP mỗi ngày giờ nằm ở trang Hôm nay của workspace,
          nơi nó có ngữ cảnh workspace để ghi vào DB. */}

      {/* Danger zone */}
      <div className="surface p-5 border-destructive/30">
        <h3 className="text-sm font-medium text-destructive">Danger zone</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Reset is irreversible — you&apos;ll lose all assessments + XP for the workspace.
        </p>
        {/* Nút "Clear preferences" đã gỡ cùng với 4 key `pref:*`: không còn
            key nào để xoá, và một nút xoá thứ không tồn tại thì chỉ làm người
            dùng tưởng mình vừa đặt lại được cái gì đó. */}
      </div>
    </div>
  );
}

function Row({
  icon: Icon,
  label,
  description,
  action,
}: {
  icon: typeof Moon;
  label: string;
  description: string;
  action: React.ReactNode;
}) {
  return (
    <div className="surface p-5 flex items-center gap-4">
      <Icon className="size-5 text-muted-foreground" />
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-medium">{label}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      {action}
    </div>
  );
}
