'use client';

/**
 * LevelEditor — rename the display label of each competency level.
 * The code (XS/S/M/L…) is fixed as the internal key; only the label teams
 * and learners see changes. Persisted via updateCompetencyLevel.
 */
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { updateCompetencyLevel } from '@/actions/workspace-admin';
import { toast } from 'sonner';

export type LevelRow = {
  id: string;
  code: string;
  label: string;
  description: string | null;
};

export function LevelEditor({ workspaceSlug, levels }: { workspaceSlug: string; levels: LevelRow[] }) {
  const [labels, setLabels] = useState<Record<string, string>>(
    Object.fromEntries(levels.map((l) => [l.id, l.label])),
  );
  const [pending, startTransition] = useTransition();

  const dirty = levels.some((l) => labels[l.id] !== l.label);

  function save() {
    startTransition(async () => {
      try {
        for (const l of levels) {
          if (labels[l.id] !== l.label) {
            await updateCompetencyLevel(workspaceSlug, l.id, labels[l.id] ?? l.label);
          }
        }
        toast.success('Đã lưu nhãn cấp độ');
      } catch (e) {
        toast.error(e instanceof Error ? `Lưu thất bại: ${e.message}` : 'Lưu thất bại');
      }
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Đổi tên hiển thị cho từng cấp (vd M → &quot;Senior&quot;). Mã nội bộ (XS/S/M/L) giữ nguyên
        nên tiến độ đã lưu không bị ảnh hưởng.
      </p>
      {levels.map((l) => (
        <div key={l.id} className="flex items-center gap-3">
          <span className="w-10 shrink-0 rounded-md bg-secondary px-2 py-1.5 text-center font-mono text-xs font-bold">
            {l.code}
          </span>
          <Input
            value={labels[l.id] ?? ''}
            maxLength={40}
            aria-label={`Nhãn cấp ${l.code}`}
            onChange={(e) => setLabels((s) => ({ ...s, [l.id]: e.target.value }))}
            className="flex-1"
          />
        </div>
      ))}
      <div className="flex justify-end">
        <Button onClick={save} disabled={pending || !dirty} className="btn-brand border-0">
          {pending ? 'Đang lưu…' : 'Lưu nhãn cấp độ'}
        </Button>
      </div>
    </div>
  );
}
