/**
 * Form đổi tên + mô tả workspace.
 *
 * Mô tả là thứ hiện trên `/share` và trên thẻ ở `/discover`. Trước khi có cột
 * `workspaces.description`, trang share phải mượn mô tả của node gốc và chỉ
 * hoạt động khi cây có đúng một gốc — nên trên thực tế nó không bao giờ hiện.
 */
'use client';

import { useId, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { renameWorkspace } from '@/actions/workspace-admin';

const DESCRIPTION_MAX = 280;

export function RenameWorkspaceForm({
  workspaceSlug,
  initialName,
  initialDescription,
}: {
  workspaceSlug: string;
  initialName: string;
  initialDescription?: string | null;
}) {
  const nameId = useId();
  const descId = useId();
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription ?? '');
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const router = useRouter();

  const dirty =
    name.trim() !== initialName.trim() ||
    description.trim() !== (initialDescription ?? '').trim();

  function submit() {
    setMsg(null);
    setError(false);
    startTransition(async () => {
      try {
        // Gửi thẳng chuỗi, kể cả rỗng: rỗng nghĩa là XOÁ mô tả. Quy về
        // `undefined` sẽ biến thao tác xoá thành không-làm-gì.
        await renameWorkspace(workspaceSlug, name.trim(), description.trim());
        setMsg('Đã lưu.');
        router.refresh();
      } catch (e) {
        setError(true);
        setMsg(e instanceof Error ? e.message : 'Không lưu được, thử lại.');
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor={nameId} className="text-xs font-medium text-muted-foreground">
          Tên workspace
        </label>
        <Input
          id={nameId}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor={descId} className="text-xs font-medium text-muted-foreground">
          Mô tả ngắn
        </label>
        <Textarea
          id={descId}
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, DESCRIPTION_MAX))}
          maxLength={DESCRIPTION_MAX}
          rows={3}
          placeholder="Một hai câu về lộ trình này — hiện trên trang chia sẻ và thẻ ở Khám phá."
        />
        <p className="text-right text-[11px] tabular-nums text-muted-foreground">
          {description.length}/{DESCRIPTION_MAX}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={submit} disabled={!dirty || pending || name.trim().length === 0}>
          <Save className="size-4" />
          {pending ? 'Đang lưu…' : 'Lưu'}
        </Button>
        {msg && (
          <p
            className={`text-xs ${error ? 'text-destructive' : 'text-muted-foreground'}`}
            role={error ? 'alert' : 'status'}
          >
            {msg}
          </p>
        )}
      </div>
    </div>
  );
}
