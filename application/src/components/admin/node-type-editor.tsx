'use client';

/**
 * NodeTypeEditor — per-node-type appearance overrides (emoji + accent color).
 * Applies to the node detail header icon/label. Clearing both fields returns
 * the built-in Lucide icon + default color.
 */
import { useState, useTransition } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ACCENT_PALETTE, EMOJI_PALETTE } from '@/lib/theme/workspace-theme';
import { saveNodeTypeAppearance } from '@/actions/workspace-admin';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export type NodeTypeRow = {
  nodeType: string;
  label: string;
  icon: string | null;
  color: string | null;
};

type Override = { icon: string | null; color: string | null };

export function NodeTypeEditor({
  workspaceSlug,
  types,
}: {
  workspaceSlug: string;
  types: NodeTypeRow[];
}) {
  const [overrides, setOverrides] = useState<Record<string, Override>>(
    Object.fromEntries(types.map((t) => [t.nodeType, { icon: t.icon, color: t.color }])),
  );
  const [openType, setOpenType] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const dirty = types.some(
    (t) => overrides[t.nodeType]?.icon !== t.icon || overrides[t.nodeType]?.color !== t.color,
  );

  function save() {
    startTransition(async () => {
      try {
        const rows = types.map((t) => ({
          nodeType: t.nodeType,
          icon: overrides[t.nodeType]?.icon ?? null,
          color: overrides[t.nodeType]?.color ?? null,
        }));
        await saveNodeTypeAppearance(workspaceSlug, rows);
        toast.success('Đã lưu ngoại hình node types');
      } catch (e) {
        toast.error(e instanceof Error ? `Lưu thất bại: ${e.message}` : 'Lưu thất bại');
      }
    });
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Đổi icon (emoji) + màu cho từng loại node — áp ở tiêu đề trang node. Xoá cả 2 để trở về mặc định.
      </p>
      {types.map((t) => {
        const o = overrides[t.nodeType] ?? { icon: null, color: null };
        const open = openType === t.nodeType;
        return (
          <div key={t.nodeType} className="rounded-xl border border-border">
            <button
              type="button"
              onClick={() => setOpenType(open ? null : t.nodeType)}
              className="flex w-full items-center gap-3 p-3 text-left hover:bg-secondary/40 transition-colors"
              aria-expanded={open}
            >
              <span
                className="flex size-8 items-center justify-center rounded-lg text-base font-emoji"
                style={{ background: `${o.color ?? '#888'}22`, color: o.color ?? undefined }}
              >
                {o.icon ?? '•'}
              </span>
              <span className="flex-1 text-sm font-medium">{t.label}</span>
              <code className="text-[10px] text-muted-foreground">{t.nodeType}</code>
              {o.color && <span className="size-3 rounded-full" style={{ background: o.color }} />}
            </button>

            {open && (
              <div className="space-y-3 border-t border-border p-3">
                <div>
                  <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Icon (emoji)
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      onClick={() => setOverrides((s) => ({ ...s, [t.nodeType]: { ...o, icon: null } }))}
                      className={cn(
                        'flex size-8 items-center justify-center rounded-lg border text-xs transition-colors hover:bg-secondary',
                        o.icon === null ? 'border-primary bg-primary/10' : 'border-border',
                      )}
                      title="Mặc định (icon Lucide)"
                    >
                      <RotateCcw className="size-3" />
                    </button>
                    {EMOJI_PALETTE.map((e) => (
                      <button
                        key={e}
                        type="button"
                        onClick={() => setOverrides((s) => ({ ...s, [t.nodeType]: { ...o, icon: e } }))}
                        aria-label={`${t.label} icon ${e}`}
                        aria-pressed={o.icon === e}
                        className={cn(
                          'flex size-8 items-center justify-center rounded-lg border text-base font-emoji transition-colors hover:bg-secondary',
                          o.icon === e ? 'border-primary bg-primary/10' : 'border-border',
                        )}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Màu
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setOverrides((s) => ({ ...s, [t.nodeType]: { ...o, color: null } }))}
                      className={cn(
                        'flex size-7 items-center justify-center rounded-full border text-[9px] transition-colors hover:bg-secondary',
                        o.color === null ? 'border-primary' : 'border-border',
                      )}
                      title="Mặc định"
                    >
                      <RotateCcw className="size-3" />
                    </button>
                    {ACCENT_PALETTE.map((a) => (
                      <button
                        key={a.hex}
                        type="button"
                        onClick={() => setOverrides((s) => ({ ...s, [t.nodeType]: { ...o, color: a.hex } }))}
                        aria-label={`${t.label} màu ${a.label}`}
                        aria-pressed={o.color === a.hex}
                        className={cn(
                          'size-7 rounded-full border-2 transition-transform hover:scale-110',
                          o.color === a.hex ? 'border-foreground' : 'border-transparent',
                        )}
                        style={{ background: a.hex }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
      <div className="flex justify-end pt-1">
        <Button onClick={save} disabled={pending || !dirty} className="btn-brand border-0">
          {pending ? 'Đang lưu…' : 'Lưu node types'}
        </Button>
      </div>
    </div>
  );
}
