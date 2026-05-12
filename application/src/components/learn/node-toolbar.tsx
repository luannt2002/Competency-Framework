'use client';

/**
 * Inline action toolbar for a node detail page:
 *  - Toggle done (with hierarchical gate enforced server-side)
 *  - Add child node
 *  - Edit current node
 *  - Delete (with subtree confirmation)
 *
 * The "Đánh dấu xong" button is optimistic — the visual flips immediately
 * (and confetti fires) before the server commits. On error we revert and
 * surface a "Lỗi, đã hoàn tác" toast.
 */
import { useOptimistic, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  CheckCircle2,
  Circle,
  Plus,
  Loader2,
  Trash2,
  Pencil,
  X,
  Save,
} from 'lucide-react';
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
  toggleNodeDone,
  createTreeNode,
  updateTreeNode,
  deleteTreeNode,
} from '@/actions/tree-nodes';
import { NODE_TYPE_OPTIONS } from '@/lib/tree/node-meta';
import { fireConfetti } from './confetti';
import { useDraft } from '@/lib/hooks/use-draft';

type Props = {
  workspaceSlug: string;
  node: {
    id: string;
    title: string;
    nodeType: string;
    description: string | null;
    bodyMd: string | null;
    estMinutes: number | null;
    status: 'todo' | 'in_progress' | 'done';
    childrenCount: number;
    parentSlug?: string | null;
  };
};

export function NodeToolbar({ workspaceSlug, node }: Props) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  // Optimistic mirror of the done state. We don't try to model the cascade
  // here (children blocking the toggle) — that comes from the server. The
  // visual flips immediately; if the server rejects we revert and toast.
  const [optimisticDone, applyOptimisticDone] = useOptimistic(
    node.status === 'done',
    (_prev, next: boolean) => next,
  );
  const isDone = optimisticDone;

  const onToggleDone = () => {
    const willBeDone = !isDone;
    // Fire confetti up-front when marking done — feels instant. (The confetti
    // helper itself respects prefers-reduced-motion.)
    if (willBeDone) {
      fireConfetti({ intensity: node.childrenCount > 0 ? 'big' : 'small' });
    }
    startTransition(async () => {
      // Flip the visual immediately inside the transition so React keeps the
      // optimistic state alive until the server response settles.
      applyOptimisticDone(willBeDone);
      try {
        const res = await toggleNodeDone(workspaceSlug, node.id);
        if (res.action === 'marked_done') {
          toast.success('Đánh dấu xong');
        } else {
          toast.info(
            res.cascadedUp > 0
              ? `Đã bỏ done · cũng bỏ ${res.cascadedUp} cấp cha`
              : 'Đã bỏ done',
          );
        }
        router.refresh();
      } catch (e) {
        // Revert the optimistic flip. useOptimistic auto-reverts when the
        // transition ends, but we also re-apply the original so the brief
        // window before refresh shows the correct state.
        applyOptimisticDone(!willBeDone);
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes('INCOMPLETE_CHILDREN')) {
          const parts = msg.split(':');
          toast.error('Chưa thể done, đã hoàn tác', {
            description:
              parts.slice(2).join(':') || 'Phải hoàn thành các mục con trước.',
          });
        } else {
          toast.error('Lỗi, đã hoàn tác', { description: msg });
        }
      }
    });
  };

  const onDelete = () => {
    const msg =
      node.childrenCount > 0
        ? `Xoá "${node.title}" và TẤT CẢ ${node.childrenCount} mục con bên dưới?`
        : `Xoá "${node.title}"?`;
    if (!window.confirm(msg)) return;
    startTransition(async () => {
      try {
        await deleteTreeNode(workspaceSlug, node.id);
        toast.success('Đã xoá');
        // Navigate back to parent or root
        if (node.parentSlug) router.push(`/w/${workspaceSlug}/n/${node.parentSlug}`);
        else router.push(`/w/${workspaceSlug}`);
      } catch (e) {
        toast.error('Lỗi xoá', { description: String(e) });
      }
    });
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={onToggleDone}
          disabled={pending}
          variant={isDone ? 'outline' : 'default'}
          size="sm"
          aria-busy={pending}
        >
          {/* Optimistic visual: the icon flips to Circle/CheckCircle2 immediately
              based on the optimistic state, while a tiny inline spinner badge
              indicates the server is still confirming. This way the user sees
              the new state instantly but still has a "saving" affordance. */}
          {isDone ? <Circle className="size-3" /> : <CheckCircle2 className="size-3" />}
          {isDone ? 'Bỏ done' : 'Đánh dấu xong'}
          {pending && <Loader2 className="size-3 animate-spin opacity-70" />}
        </Button>
        <Button onClick={() => setAddOpen(true)} variant="outline" size="sm">
          <Plus className="size-3" />
          Thêm con
        </Button>
        <Button onClick={() => setEditOpen(true)} variant="outline" size="sm">
          <Pencil className="size-3" />
          Sửa
        </Button>
        <Button onClick={onDelete} disabled={pending} variant="ghost" size="sm" className="text-destructive hover:text-destructive">
          <Trash2 className="size-3" />
          Xoá
        </Button>
      </div>

      <AddChildDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        workspaceSlug={workspaceSlug}
        parentId={node.id}
        parentTitle={node.title}
      />
      <EditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        workspaceSlug={workspaceSlug}
        node={node}
      />
    </>
  );
}

function AddChildDialog({
  open,
  onOpenChange,
  workspaceSlug,
  parentId,
  parentTitle,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  workspaceSlug: string;
  parentId: string;
  parentTitle: string;
}) {
  const router = useRouter();
  // Persist draft to localStorage so a stray refresh / nav doesn't nuke a
  // partially-typed child. Cleared on submit success.
  const [draft, setDraft, clearDraft] = useDraft(`tree-node:${parentId}:add`, {
    title: '',
    description: '',
    nodeType: 'lesson',
    estMinutes: '' as number | '',
    bodyMd: '',
  });
  const title = draft.title;
  const description = draft.description;
  const nodeType = draft.nodeType;
  const estMinutes = draft.estMinutes;
  const bodyMd = draft.bodyMd;
  const setTitle = (v: string) => setDraft({ ...draft, title: v });
  const setDescription = (v: string) => setDraft({ ...draft, description: v });
  const setNodeType = (v: string) => setDraft({ ...draft, nodeType: v });
  const setEstMinutes = (v: number | '') => setDraft({ ...draft, estMinutes: v });
  const setBodyMd = (v: string) => setDraft({ ...draft, bodyMd: v });
  const [pending, startTransition] = useTransition();

  const submit = () => {
    if (!title.trim()) return;
    startTransition(async () => {
      try {
        await createTreeNode({
          workspaceSlug,
          parentId,
          nodeType,
          title: title.trim(),
          description: description.trim() || undefined,
          estMinutes: estMinutes === '' ? undefined : Number(estMinutes),
          bodyMd: bodyMd.trim() || undefined,
        });
        toast.success('Đã thêm');
        clearDraft();
        onOpenChange(false);
        router.refresh();
      } catch (e) {
        toast.error('Lỗi tạo', { description: String(e) });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Thêm con vào &quot;{parentTitle}&quot;</DialogTitle>
          <DialogDescription>
            Có thể là bất kỳ cấp nào: bài học, lab, project, milestone, hoặc giai đoạn nhỏ hơn.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium block mb-1.5">Loại *</label>
            <select
              value={nodeType}
              onChange={(e) => setNodeType(e.target.value)}
              className="w-full h-10 rounded-xl border border-border bg-secondary/40 px-3 text-sm"
            >
              {NODE_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium block mb-1.5">Tên *</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="vd: Bài 1.1 — IAM cơ bản" autoFocus />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1.5">Mô tả ngắn</label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1.5">Nội dung (markdown, optional)</label>
            <Textarea value={bodyMd} onChange={(e) => setBodyMd(e.target.value)} rows={4} placeholder="Mục tiêu, các bước, tài liệu..." />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1.5">Thời lượng (phút)</label>
            <Input
              type="number"
              min={0}
              max={10000}
              value={estMinutes}
              onChange={(e) => setEstMinutes(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-32"
              placeholder="30"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}><X className="size-4" />Huỷ</Button>
          <Button onClick={submit} disabled={pending || !title.trim()}>
            {pending && <Loader2 className="size-3 animate-spin" />}
            <Save className="size-4" />Tạo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditDialog({
  open,
  onOpenChange,
  workspaceSlug,
  node,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  workspaceSlug: string;
  node: { id: string; title: string; nodeType: string; description: string | null; bodyMd: string | null; estMinutes: number | null };
}) {
  const router = useRouter();
  // Edit drafts persist per-node. The initial value falls back to the server
  // copy so existing content shows even before the localStorage read fires.
  const [draft, setDraft, clearDraft] = useDraft(`tree-node:${node.id}:edit`, {
    title: node.title,
    nodeType: node.nodeType,
    description: node.description ?? '',
    bodyMd: node.bodyMd ?? '',
    estMinutes: (node.estMinutes ?? '') as number | '',
  });
  const title = draft.title;
  const nodeType = draft.nodeType;
  const description = draft.description;
  const bodyMd = draft.bodyMd;
  const estMinutes = draft.estMinutes;
  const setTitle = (v: string) => setDraft({ ...draft, title: v });
  const setNodeType = (v: string) => setDraft({ ...draft, nodeType: v });
  const setDescription = (v: string) => setDraft({ ...draft, description: v });
  const setBodyMd = (v: string) => setDraft({ ...draft, bodyMd: v });
  const setEstMinutes = (v: number | '') => setDraft({ ...draft, estMinutes: v });
  const [pending, startTransition] = useTransition();

  const submit = () => {
    if (!title.trim()) return;
    startTransition(async () => {
      try {
        await updateTreeNode({
          workspaceSlug,
          nodeId: node.id,
          title: title.trim(),
          nodeType,
          description: description.trim() || undefined,
          bodyMd: bodyMd.trim() || undefined,
          estMinutes: estMinutes === '' ? undefined : Number(estMinutes),
        });
        toast.success('Đã cập nhật');
        clearDraft();
        onOpenChange(false);
        router.refresh();
      } catch (e) {
        toast.error('Lỗi', { description: String(e) });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sửa node</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium block mb-1.5">Loại *</label>
            <select
              value={nodeType}
              onChange={(e) => setNodeType(e.target.value)}
              className="w-full h-10 rounded-xl border border-border bg-secondary/40 px-3 text-sm"
            >
              {NODE_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium block mb-1.5">Tên *</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1.5">Mô tả ngắn</label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1.5">Nội dung (markdown)</label>
            <Textarea value={bodyMd} onChange={(e) => setBodyMd(e.target.value)} rows={6} />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1.5">Thời lượng (phút)</label>
            <Input
              type="number"
              min={0}
              max={10000}
              value={estMinutes}
              onChange={(e) => setEstMinutes(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-32"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}><X className="size-4" />Huỷ</Button>
          <Button onClick={submit} disabled={pending || !title.trim()}>
            {pending && <Loader2 className="size-3 animate-spin" />}
            <Save className="size-4" />Lưu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
