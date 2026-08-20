'use client';

/**
 * Quick-add for the Daily Planner (USER_FLOWS.md → Flow B5 "+ Add custom task").
 *
 * Collapsed it is a single button; expanded it is a one-line form (title +
 * optional minutes). Submits `addCustomTask`, then refreshes the server
 * component so the new row appears in the focus list.
 */
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { addCustomTask } from '@/actions/daily-planner';

type Props = {
  workspaceSlug: string;
  /** `inline` = compact button for the header; `block` = full-width CTA. */
  variant?: 'inline' | 'block';
  label?: string;
};

export function DailyQuickAdd({
  workspaceSlug,
  variant = 'inline',
  label = 'Thêm task',
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [minutes, setMinutes] = useState<number | ''>('');
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    startTransition(async () => {
      try {
        await addCustomTask({
          workspaceSlug,
          title: trimmed,
          estMinutes: minutes === '' ? undefined : Number(minutes),
        });
        toast.success('Đã thêm task', { description: trimmed });
        setTitle('');
        setMinutes('');
        setOpen(false);
        router.refresh();
      } catch (err) {
        toast.error('Không thêm được task', {
          description: err instanceof Error ? err.message : String(err),
        });
      }
    });
  };

  if (!open) {
    return (
      <Button
        variant={variant === 'block' ? 'default' : 'outline'}
        size="sm"
        onClick={() => setOpen(true)}
        className={variant === 'block' ? 'mt-2' : undefined}
      >
        <Plus className="size-3" />
        {label}
      </Button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="flex w-full max-w-md items-center gap-2"
      aria-label="Thêm task thủ công"
    >
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Hôm nay tôi sẽ…"
        maxLength={200}
        autoFocus
        aria-label="Tên task"
      />
      <Input
        type="number"
        min={1}
        max={600}
        value={minutes}
        onChange={(e) => setMinutes(e.target.value === '' ? '' : Number(e.target.value))}
        placeholder="phút"
        className="w-20"
        aria-label="Thời lượng ước tính (phút)"
      />
      <Button type="submit" size="sm" disabled={pending || !title.trim()}>
        {pending ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" />}
        Lưu
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 shrink-0"
        onClick={() => setOpen(false)}
        aria-label="Huỷ"
      >
        <X className="size-4" />
      </Button>
    </form>
  );
}
