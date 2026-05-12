'use client';

/**
 * Inline action toolbar for a node detail page:
 *  - Toggle done (with hierarchical gate enforced server-side)
 *  - Add child node
 *  - Edit current node
 *  - Delete (with subtree confirmation)
 */
import { useState, useTransition } from 'react';
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

  const isDone = node.status === 'done';

  const onToggleDone = () => {
    startTransition(async () => {
      try {
        const res = await toggleNodeDone(workspaceSlug, node.id);
        if (res.action === 'marked_done') {
          toast.success('✅ Đánh dấu xong');
        } else {
          toast.info(
            res.cascadedUp > 0
              ? `Đã bỏ done · cũng bỏ ${res.cascadedUp} cấp cha`
              : 'Đã bỏ done',
          );
        }
        router.refresh();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes('INCOMPLETE_CHILDREN')) {
          const parts = msg.split(':');
          toast.error('🔒 Chưa thể done', {
            description: parts.slice(2).join(':') || 'Phải hoàn thành các mục con trước.',
          });
        } else {
          toast.error('Lỗi', { description: msg });
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
        >
          {pending ? (
            <Loader2 className="size-3 animate-spin" />
          ) : isDone ? (
            <Circle className="size-3" />
          ) : (
            <CheckCircle2 className="size-3" />
          )}
          {isDone ? 'Bỏ done' : 'Đánh dấu xong'}
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
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [nodeType, setNodeType] = useState('lesson');
  const [estMinutes, setEstMinutes] = useState<number | ''>('');
  const [bodyMd, setBodyMd] = useState('');
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
        setTitle('');
        setDescription('');
        setBodyMd('');
        setEstMinutes('');
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
  const [title, setTitle] = useState(node.title);
  const [nodeType, setNodeType] = useState(node.nodeType);
  const [description, setDescription] = useState(node.description ?? '');
  const [bodyMd, setBodyMd] = useState(node.bodyMd ?? '');
  const [estMinutes, setEstMinutes] = useState<number | ''>(node.estMinutes ?? '');
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
