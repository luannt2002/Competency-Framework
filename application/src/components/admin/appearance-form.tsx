'use client';

/**
 * AppearanceForm — workspace icon (emoji) + accent color picker.
 * Both lists come from the curated palettes in workspace-theme.ts; the same
 * module whitelists values server-side. Live preview updates the local
 * selection state; "Lưu" persists via updateWorkspaceAppearance.
 */
import { useState, useTransition } from 'react';
import { Check, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ACCENT_PALETTE, EMOJI_PALETTE, hexToHsl } from '@/lib/theme/workspace-theme';
import { updateWorkspaceAppearance } from '@/actions/workspace-admin';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export function AppearanceForm({
  workspaceSlug,
  initialIcon,
  initialColor,
}: {
  workspaceSlug: string;
  initialIcon: string | null;
  initialColor: string | null;
}) {
  const [icon, setIcon] = useState(initialIcon ?? EMOJI_PALETTE[0]);
  const [color, setColor] = useState(initialColor ?? ACCENT_PALETTE[0]!.hex);
  const [pending, startTransition] = useTransition();

  const dirty = icon !== (initialIcon ?? EMOJI_PALETTE[0]) || color !== (initialColor ?? ACCENT_PALETTE[0]!.hex);

  function save() {
    startTransition(async () => {
      try {
        await updateWorkspaceAppearance(workspaceSlug, icon, color);
        toast.success('Đã lưu ngoại hình workspace');
      } catch (e) {
        toast.error(e instanceof Error ? `Lưu thất bại: ${e.message}` : 'Lưu thất bại');
      }
    });
  }

  const hsl = hexToHsl(color);

  return (
    <div className="space-y-6">
      {/* Live preview */}
      <div className="flex items-center gap-3 rounded-xl border border-border bg-secondary/30 p-4">
        <div
          className="flex size-12 items-center justify-center rounded-xl text-2xl font-bold text-white shadow-lg"
          style={{ background: `linear-gradient(135deg, ${color} 0%, hsl(${hsl}) 100%)` }}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold">Xem trước</div>
          <div className="text-xs text-muted-foreground">
            Icon + màu accent sẽ áp cho sidebar, nút bấm và tiêu điểm của workspace này.
          </div>
        </div>
        <span
          className="ml-auto hidden sm:inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold"
          style={{ background: `${color}22`, color }}
        >
          <Palette className="size-3" /> Accent
        </span>
      </div>

      {/* Emoji picker */}
      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Biểu tượng workspace
        </div>
        <div className="grid grid-cols-8 sm:grid-cols-10 gap-1.5">
          {EMOJI_PALETTE.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setIcon(e)}
              aria-label={`Chọn biểu tượng ${e}`}
              aria-pressed={icon === e}
              className={cn(
                'flex size-10 items-center justify-center rounded-lg border text-xl transition-all hover:bg-secondary',
                icon === e ? 'border-primary bg-primary/10 ring-2 ring-primary/30' : 'border-border',
              )}
            >
              {e}
            </button>
          ))}
        </div>
      </div>

      {/* Color palette */}
      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Màu accent
        </div>
        <div className="flex flex-wrap gap-2">
          {ACCENT_PALETTE.map((a) => (
            <button
              key={a.hex}
              type="button"
              onClick={() => setColor(a.hex)}
              title={a.label}
              aria-label={`Chọn màu ${a.label}`}
              aria-pressed={color === a.hex}
              className={cn(
                'flex size-10 items-center justify-center rounded-full border-2 transition-transform hover:scale-110',
                color === a.hex ? 'border-foreground' : 'border-transparent',
              )}
              style={{ background: a.hex }}
            >
              {color === a.hex && <Check className="size-4 text-white" />}
            </button>
          ))}
        </div>
        <div className="mt-2 text-xs text-muted-foreground">
          Đang chọn: <span className="font-semibold text-foreground">{ACCENT_PALETTE.find((a) => a.hex === color)?.label}</span>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={save} disabled={pending || !dirty} className="btn-brand border-0">
          {pending ? 'Đang lưu…' : 'Lưu ngoại hình'}
        </Button>
      </div>
    </div>
  );
}
