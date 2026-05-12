'use client';

/**
 * EffectsSection — small client island wired to the `sound-enabled`
 * preference (see `useSoundPreference`). Renders a Vietnamese-language
 * "Hiệu ứng" card with a checkbox toggle that persists to localStorage.
 *
 * Kept separate from `SettingsForm` so it can be appended inside the
 * server-rendered `/settings` page without making that page client-side.
 */
import { Sparkles } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useSoundPreference } from '@/lib/hooks/use-sound-preference';

export function EffectsSection() {
  const [enabled, setEnabled] = useSoundPreference();

  return (
    <section className="surface p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-amber-500" />
        <h2 className="text-sm font-semibold uppercase tracking-wider">
          Hiệu ứng
        </h2>
      </div>

      <label className="flex items-start justify-between gap-4 cursor-pointer">
        <div>
          <div className="text-sm font-medium">
            Bật âm thanh khi đánh dấu xong
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Phát một tiếng &quot;ding&quot; nhẹ sau khi confetti nổ — tắt mặc định.
          </p>
        </div>
        <Switch checked={enabled} onCheckedChange={setEnabled} />
      </label>
    </section>
  );
}
