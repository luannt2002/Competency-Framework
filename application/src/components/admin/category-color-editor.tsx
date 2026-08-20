'use client';

/**
 * CategoryColorEditor — pick a palette color (or default gray) per skill
 * category. Applied to the skills table badges, filter chips and drawer tag.
 */
import { useState, useTransition } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ACCENT_PALETTE } from '@/lib/theme/workspace-theme';
import { updateCategoryColor } from '@/actions/workspace-admin';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { NEUTRAL_FALLBACK } from '@/lib/constants/palette';

export type CategoryRow = { id: string; name: string; color: string | null };

export function CategoryColorEditor({
  workspaceSlug,
  categories,
}: {
  workspaceSlug: string;
  categories: CategoryRow[];
}) {
  const [colors, setColors] = useState<Record<string, string | null>>(
    Object.fromEntries(categories.map((c) => [c.id, c.color])),
  );
  const [pending, startTransition] = useTransition();

  const dirty = categories.some((c) => colors[c.id] !== c.color);

  function save() {
    startTransition(async () => {
      try {
        for (const c of categories) {
          if (colors[c.id] !== c.color) {
            await updateCategoryColor(workspaceSlug, c.id, colors[c.id] ?? null);
          }
        }
        toast.success('Đã lưu màu danh mục');
      } catch (e) {
        toast.error(e instanceof Error ? `Lưu thất bại: ${e.message}` : 'Lưu thất bại');
      }
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Màu danh mục hiển thị ở chip lọc, badge bảng kỹ năng và drawer.
      </p>
      {categories.map((c) => {
        const cur = colors[c.id] ?? null;
        return (
          <div key={c.id} className="flex items-center gap-3">
            <span
              className="size-3.5 shrink-0 rounded-full border"
              style={{ background: cur ?? NEUTRAL_FALLBACK, borderColor: `${cur ?? NEUTRAL_FALLBACK}60` }}
            />
            <span className="flex-1 truncate text-sm font-medium">{c.name}</span>
            <div className="flex flex-wrap items-center gap-1 justify-end">
              <button
                type="button"
                onClick={() => setColors((s) => ({ ...s, [c.id]: null }))}
                title="Mặc định (xám)"
                aria-label={`Mặc định cho ${c.name}`}
                className={cn(
                  'flex size-6 items-center justify-center rounded-full border transition-colors hover:bg-secondary',
                  cur === null ? 'border-primary' : 'border-border',
                )}
              >
                <RotateCcw className="size-3" />
              </button>
              {ACCENT_PALETTE.map((a) => (
                <button
                  key={a.hex}
                  type="button"
                  onClick={() => setColors((s) => ({ ...s, [c.id]: a.hex }))}
                  aria-label={`${c.name} màu ${a.label}`}
                  aria-pressed={cur === a.hex}
                  className={cn(
                    'size-6 rounded-full border-2 transition-transform hover:scale-110',
                    cur === a.hex ? 'border-foreground' : 'border-transparent',
                  )}
                  style={{ background: a.hex }}
                />
              ))}
            </div>
          </div>
        );
      })}
      <div className="flex justify-end">
        <Button onClick={save} disabled={pending || !dirty} className="btn-brand border-0">
          {pending ? 'Đang lưu…' : 'Lưu màu danh mục'}
        </Button>
      </div>
    </div>
  );
}
