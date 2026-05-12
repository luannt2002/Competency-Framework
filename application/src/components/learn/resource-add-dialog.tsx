'use client';

/**
 * "Add resource" dialog — client component.
 *
 * Triggered by the small "+ Thêm tài liệu" button inside ResourcesSection.
 * Form fields: kind (select) + title + url + description. Submits via the
 * `addNodeResource` server action and refreshes the route on success.
 *
 * Mirrors JournalEntryDialog's UX for visual consistency.
 */
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Plus, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { addNodeResource } from '@/actions/node-resources';

const KIND_OPTIONS: Array<{ value: 'link' | 'video' | 'doc' | 'book'; label: string }> = [
  { value: 'link', label: 'Link' },
  { value: 'video', label: 'Video' },
  { value: 'doc', label: 'Tài liệu / Doc' },
  { value: 'book', label: 'Sách' },
];

export function ResourceAddDialog({
  workspaceSlug,
  nodeId,
}: {
  workspaceSlug: string;
  nodeId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<'link' | 'video' | 'doc' | 'book'>('link');
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [pending, startTransition] = useTransition();

  const reset = () => {
    setKind('link');
    setTitle('');
    setUrl('');
    setDescription('');
  };

  const submit = () => {
    if (!title.trim() || !url.trim()) return;
    startTransition(async () => {
      try {
        await addNodeResource({
          workspaceSlug,
          nodeId,
          kind,
          title: title.trim(),
          url: url.trim(),
          description: description.trim() || undefined,
        });
        toast.success('Đã thêm tài liệu');
        reset();
        setOpen(false);
        router.refresh();
      } catch (e) {
        toast.error('Lỗi', { description: String(e) });
      }
    });
  };

  const onOpenChange = (v: boolean) => {
    if (!v) reset();
    setOpen(v);
  };

  return (
    <>
      <Button onClick={() => setOpen(true)} size="sm" variant="default">
        <Plus className="size-3" />
        Thêm tài liệu
      </Button>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Thêm tài liệu</DialogTitle>
            <DialogDescription>
              Gắn link, video, doc hoặc sách hữu ích cho mục này — mọi thành viên đều thấy.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium block mb-1.5">Loại *</label>
              <select
                value={kind}
                onChange={(e) =>
                  setKind(e.target.value as 'link' | 'video' | 'doc' | 'book')
                }
                className="w-full h-10 rounded-xl border border-border bg-secondary/40 px-3 text-sm"
              >
                {KIND_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium block mb-1.5">Tiêu đề *</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="vd: AWS IAM official docs"
                maxLength={200}
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1.5">URL *</label>
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://..."
                maxLength={2000}
                type="url"
              />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1.5">
                Mô tả ngắn (tuỳ chọn)
              </label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                maxLength={2000}
                placeholder="Lý do nên đọc / nội dung tóm tắt"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              <X className="size-4" />
              Huỷ
            </Button>
            <Button
              onClick={submit}
              disabled={pending || !title.trim() || !url.trim()}
            >
              {pending && <Loader2 className="size-3 animate-spin" />}
              <Save className="size-4" />
              Thêm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
