'use client';

/**
 * Create / edit dialog for a node journal entry.
 *
 * Two modes:
 *  - `mode="create"`: nodeId is required; submit calls createJournalEntry.
 *  - `mode="edit"`:   entry is required; submit calls updateJournalEntry.
 *
 * Mirrors the AddChildDialog / EditDialog UX in node-toolbar.tsx so the feel
 * stays consistent.
 */
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Save, X } from 'lucide-react';
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
import {
  createJournalEntry,
  updateJournalEntry,
} from '@/actions/node-journal';
import { useDraft } from '@/lib/hooks/use-draft';

type CreateProps = {
  mode: 'create';
  open: boolean;
  onOpenChange: (v: boolean) => void;
  workspaceSlug: string;
  nodeId: string;
};

type EditProps = {
  mode: 'edit';
  open: boolean;
  onOpenChange: (v: boolean) => void;
  workspaceSlug: string;
  entry: {
    id: string;
    title: string;
    bodyMd: string;
    tags: string[];
  };
};

export type JournalEntryDialogProps = CreateProps | EditProps;

export function JournalEntryDialog(props: JournalEntryDialogProps) {
  const router = useRouter();
  const initial =
    props.mode === 'edit'
      ? {
          title: props.entry.title,
          bodyMd: props.entry.bodyMd,
          tags: props.entry.tags.join(', '),
        }
      : { title: '', bodyMd: '', tags: '' };

  // Drafts are scoped per-node + per-entry (or 'new' for create mode) so a
  // stray refresh / accidental close doesn't lose an in-progress post. Cleared
  // on submit success.
  const draftKey =
    props.mode === 'edit'
      ? `journal:${props.workspaceSlug}:${props.entry.id}`
      : `journal:${props.workspaceSlug}:${props.nodeId}:new`;
  const [draft, setDraft, clearDraft] = useDraft(draftKey, initial);
  const title = draft.title;
  const bodyMd = draft.bodyMd;
  const tagsRaw = draft.tags;
  const setTitle = (v: string) => setDraft({ ...draft, title: v });
  const setBodyMd = (v: string) => setDraft({ ...draft, bodyMd: v });
  const setTagsRaw = (v: string) => setDraft({ ...draft, tags: v });
  const [pending, startTransition] = useTransition();

  const reset = () => {
    clearDraft();
  };

  const parseTags = (raw: string): string[] =>
    raw
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0 && t.length <= 40)
      .slice(0, 20);

  const submit = () => {
    if (!title.trim() || !bodyMd.trim()) return;
    const tags = parseTags(tagsRaw);
    startTransition(async () => {
      try {
        if (props.mode === 'create') {
          await createJournalEntry({
            workspaceSlug: props.workspaceSlug,
            nodeId: props.nodeId,
            title: title.trim(),
            bodyMd: bodyMd.trim(),
            tags,
          });
          toast.success('Đã đăng bài');
          clearDraft();
        } else {
          await updateJournalEntry({
            workspaceSlug: props.workspaceSlug,
            entryId: props.entry.id,
            title: title.trim(),
            bodyMd: bodyMd.trim(),
            tags,
          });
          toast.success('Đã cập nhật');
          clearDraft();
        }
        props.onOpenChange(false);
        router.refresh();
      } catch (e) {
        toast.error('Lỗi', { description: String(e) });
      }
    });
  };

  const onOpenChange = (v: boolean) => {
    if (!v && props.mode === 'create') reset();
    props.onOpenChange(v);
  };

  return (
    <Dialog open={props.open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {props.mode === 'create' ? 'Đăng bài mới' : 'Sửa bài viết'}
          </DialogTitle>
          <DialogDescription>
            {props.mode === 'create'
              ? 'Ghi chú học tập, blog post, bài lab — bất kỳ nội dung markdown nào gắn với mục này.'
              : 'Cập nhật tiêu đề, nội dung hoặc tag của bài.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium block mb-1.5">Tiêu đề *</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="vd: Học IAM ngày 1 — note + lab"
              maxLength={200}
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1.5">
              Nội dung (markdown) *
            </label>
            <Textarea
              value={bodyMd}
              onChange={(e) => setBodyMd(e.target.value)}
              rows={10}
              placeholder="# Mục tiêu&#10;...&#10;## Steps&#10;1. ..."
              maxLength={50000}
            />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1.5">
              Tags (phân tách bằng dấu phẩy)
            </label>
            <Input
              value={tagsRaw}
              onChange={(e) => setTagsRaw(e.target.value)}
              placeholder="iam, lab, week-1"
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
            disabled={pending || !title.trim() || !bodyMd.trim()}
          >
            {pending && <Loader2 className="size-3 animate-spin" />}
            <Save className="size-4" />
            {props.mode === 'create' ? 'Đăng' : 'Lưu'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
