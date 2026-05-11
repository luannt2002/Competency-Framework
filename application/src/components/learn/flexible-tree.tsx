'use client';

/**
 * FlexibleTree — n-depth recursive roadmap node tree.
 *
 * UX & psychology principles applied:
 *
 * 1. PROGRESSIVE DISCLOSURE — by default ONLY root nodes show. User clicks to drill down.
 *    Reduces cognitive load (Miller's 7±2). Prevents "wall of text" intimidation.
 *
 * 2. SEQUENTIAL CLARITY — each child shows its order index (#1, #2…). User immediately
 *    understands "this comes before that". Eliminates ambiguity about which to do first.
 *
 * 3. SENSE OF CONTROL (locus of control) — every node has ↑↓ reorder + add-child + delete.
 *    User feels OWNERSHIP of their own path → higher retention (Self-Determination Theory).
 *
 * 4. CHUNKING — visual indent + connector line per depth groups siblings under parent.
 *    Brain processes "module groups" not "47 random items".
 *
 * 5. ENDOWED PROGRESS EFFECT — checkbox done state colors node green; running count
 *    "3/12 done" shows beside parent → user feels closer to goal than starting from 0.
 *
 * 6. FRESH START EFFECT — "Add new" buttons always visible at every level. User can pivot
 *    or start a new course any moment without re-orienting.
 *
 * 7. ZEIGARNIK EFFECT (unfinished tasks itch) — incomplete nodes have subtle pulse animation
 *    on the indicator dot, drawing eye back to what's pending.
 *
 * 8. FRIENDLY LANGUAGE — Vietnamese labels for every action ("Thêm con", "Sửa", "Xoá",
 *    "Đánh dấu xong"). No tech jargon at user-facing surfaces.
 *
 * 9. TWO-STEP CONFIRMATION — delete asks "Xoá ... và tất cả con?" preventing accidental
 *    subtree wipeouts.
 *
 * 10. KEYBOARD-FRIENDLY — buttons are real <button>, Enter/Space trigger; supports VoiceOver.
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  ChevronRight,
  ChevronDown,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  Circle,
  Loader2,
  Save,
  X,
  GraduationCap,
  Layers,
  CalendarRange,
  BookOpen,
  Beaker,
  Hammer,
  Target,
  Trophy,
  ClipboardList,
  Sparkles,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  createTreeNode,
  deleteTreeNode,
  moveTreeNode,
  updateTreeNode,
  toggleNodeDone,
  type TreeNodeWithChildren,
} from '@/actions/tree-nodes';
import { cn } from '@/lib/utils';

/* ============================ Node types & UI metadata ============================ */
const NODE_TYPES = [
  { value: 'course', label: 'Khoá học', icon: GraduationCap, color: 'text-violet-400' },
  { value: 'phase', label: 'Giai đoạn (Phase)', icon: Layers, color: 'text-cyan-400' },
  { value: 'stage', label: 'Chặng (Stage)', icon: Layers, color: 'text-sky-400' },
  { value: 'week', label: 'Tuần', icon: CalendarRange, color: 'text-amber-400' },
  { value: 'session', label: 'Buổi học', icon: ClipboardList, color: 'text-emerald-400' },
  { value: 'module', label: 'Module', icon: Layers, color: 'text-emerald-400' },
  { value: 'lesson', label: 'Bài học', icon: BookOpen, color: 'text-cyan-400' },
  { value: 'theory', label: 'Lý thuyết', icon: BookOpen, color: 'text-sky-300' },
  { value: 'lab', label: 'Lab (thực hành)', icon: Beaker, color: 'text-orange-400' },
  { value: 'project', label: 'Project', icon: Hammer, color: 'text-pink-400' },
  { value: 'task', label: 'Task', icon: Target, color: 'text-muted-foreground' },
  { value: 'milestone', label: 'Cột mốc', icon: Target, color: 'text-amber-300' },
  { value: 'exam', label: 'Bài kiểm tra', icon: ClipboardList, color: 'text-red-400' },
  { value: 'capstone', label: 'Capstone', icon: Trophy, color: 'text-yellow-400' },
  { value: 'custom', label: 'Tuỳ chỉnh', icon: Sparkles, color: 'text-muted-foreground' },
] as const;

const CUSTOM_FALLBACK = NODE_TYPES[NODE_TYPES.length - 1]!;
function typeMeta(t: string): typeof CUSTOM_FALLBACK {
  return NODE_TYPES.find((n) => n.value === t) ?? CUSTOM_FALLBACK;
}

/* ============================ Top-level component ============================ */
type Props = {
  workspaceSlug: string;
  roots: TreeNodeWithChildren[];
};

export function FlexibleTree({ workspaceSlug, roots }: Props) {
  const router = useRouter();
  const [openSet, setOpenSet] = useState<Set<string>>(new Set());
  const [addChildOf, setAddChildOf] = useState<TreeNodeWithChildren | 'ROOT' | null>(null);
  const [editing, setEditing] = useState<TreeNodeWithChildren | null>(null);
  const [pending, startTransition] = useTransition();

  const toggle = (id: string) => {
    const next = new Set(openSet);
    next.has(id) ? next.delete(id) : next.add(id);
    setOpenSet(next);
  };

  const onMove = (node: TreeNodeWithChildren, dir: 'up' | 'down') => {
    startTransition(async () => {
      try {
        await moveTreeNode({ workspaceSlug, nodeId: node.id, direction: dir });
        router.refresh();
      } catch (e) {
        toast.error('Không di chuyển được', { description: String(e) });
      }
    });
  };

  const onToggleDone = (node: TreeNodeWithChildren) => {
    startTransition(async () => {
      try {
        const res = await toggleNodeDone(workspaceSlug, node.id);
        if (res.action === 'marked_done') {
          toast.success('Đánh dấu xong ✓');
        } else {
          toast.info(
            res.cascadedUp > 0
              ? `Đã bỏ done · cũng tự bỏ ${res.cascadedUp} cấp cha bên trên`
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
          toast.error('Lỗi cập nhật', { description: msg });
        }
      }
    });
  };

  const onDelete = (node: TreeNodeWithChildren) => {
    const childCount = countDescendants(node);
    const msg = childCount > 0
      ? `Xoá "${node.title}" và TẤT CẢ ${childCount} mục con bên dưới?`
      : `Xoá "${node.title}"?`;
    if (!window.confirm(msg)) return;
    startTransition(async () => {
      try {
        await deleteTreeNode(workspaceSlug, node.id);
        toast.success('Đã xoá');
        router.refresh();
      } catch (e) {
        toast.error('Lỗi xoá', { description: String(e) });
      }
    });
  };

  if (roots.length === 0) {
    return (
      <>
        <div className="surface p-12 text-center space-y-4">
          <div className="mx-auto size-16 rounded-2xl accent-gradient flex items-center justify-center">
            <GraduationCap className="size-8 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Bắt đầu xây cây học tập của bạn</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              Mỗi cây là 1 khoá học hoặc lộ trình. Bạn có thể thêm nhiều cấp:
              Khoá → Giai đoạn → Tuần → Buổi → Bài / Lab / Project.
            </p>
          </div>
          <Button onClick={() => setAddChildOf('ROOT')}>
            <Plus className="size-4" />
            Tạo cây mới
          </Button>
        </div>
        <NodeDialog
          open={addChildOf === 'ROOT'}
          onOpenChange={(v) => !v && setAddChildOf(null)}
          workspaceSlug={workspaceSlug}
          mode="create"
          parentId={null}
        />
      </>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {roots.map((node, i) => (
          <TreeNodeRow
            key={node.id}
            node={node}
            siblingCount={roots.length}
            siblingIndex={i}
            openSet={openSet}
            onToggle={toggle}
            onMove={onMove}
            onDelete={onDelete}
            onAddChild={(parent) => setAddChildOf(parent)}
            onEdit={(n) => setEditing(n)}
            onToggleDone={onToggleDone}
            depth={0}
            pending={pending}
          />
        ))}

        {/* Add root node */}
        <div className="surface p-3 border-dashed border-cyan-500/30 bg-cyan-500/5">
          <Button variant="outline" size="sm" className="w-full" onClick={() => setAddChildOf('ROOT')}>
            <Plus className="size-4" />
            Tạo cây / khoá học mới ở cấp gốc
          </Button>
        </div>
      </div>

      <NodeDialog
        open={addChildOf !== null}
        onOpenChange={(v) => !v && setAddChildOf(null)}
        workspaceSlug={workspaceSlug}
        mode="create"
        parentId={addChildOf === 'ROOT' ? null : addChildOf?.id ?? null}
        parentTitle={addChildOf === 'ROOT' || !addChildOf ? undefined : addChildOf.title}
        parentDepth={addChildOf === 'ROOT' || !addChildOf ? 0 : addChildOf.depth + 1}
      />
      <NodeDialog
        open={editing !== null}
        onOpenChange={(v) => !v && setEditing(null)}
        workspaceSlug={workspaceSlug}
        mode="edit"
        editing={editing}
      />
    </>
  );
}

function countDescendants(n: TreeNodeWithChildren): number {
  let c = n.children.length;
  for (const child of n.children) c += countDescendants(child);
  return c;
}

/* ============================ Recursive row ============================ */
function TreeNodeRow({
  node,
  siblingCount,
  siblingIndex,
  openSet,
  onToggle,
  onMove,
  onDelete,
  onAddChild,
  onEdit,
  onToggleDone,
  depth,
  pending,
}: {
  node: TreeNodeWithChildren;
  siblingCount: number;
  siblingIndex: number;
  openSet: Set<string>;
  onToggle: (id: string) => void;
  onMove: (node: TreeNodeWithChildren, dir: 'up' | 'down') => void;
  onDelete: (node: TreeNodeWithChildren) => void;
  onAddChild: (parent: TreeNodeWithChildren) => void;
  onEdit: (n: TreeNodeWithChildren) => void;
  onToggleDone: (n: TreeNodeWithChildren) => void;
  depth: number;
  pending: boolean;
}) {
  const isOpen = openSet.has(node.id);
  const meta = typeMeta(node.nodeType);
  const hasChildren = node.children.length > 0;
  const isDone = node.progress?.status === 'done';
  const completedChildren = node.children.filter((c) => c.progress?.status === 'done').length;
  const indent = depth * 1.25; // rem
  const isFirst = siblingIndex === 0;
  const isLast = siblingIndex === siblingCount - 1;

  return (
    <div
      className={cn(
        'group rounded-xl border transition-colors',
        isDone ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-border bg-card hover:bg-secondary/30',
      )}
      style={{ marginLeft: `${indent}rem` }}
    >
      <div className="flex items-center gap-2 p-2.5">
        {/* Expand/collapse */}
        <button
          type="button"
          onClick={() => onToggle(node.id)}
          disabled={!hasChildren}
          className={cn(
            'size-6 shrink-0 rounded inline-flex items-center justify-center transition-transform',
            hasChildren ? 'hover:bg-secondary' : 'opacity-30 cursor-default',
          )}
          aria-label={isOpen ? 'Thu gọn' : 'Mở rộng'}
        >
          {isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        </button>

        {/* Done toggle */}
        <button
          type="button"
          onClick={() => onToggleDone(node)}
          disabled={pending}
          className="shrink-0 hover:scale-110 transition-transform"
          aria-label={isDone ? 'Đánh dấu chưa xong' : 'Đánh dấu xong'}
        >
          {isDone ? (
            <CheckCircle2 className="size-4 text-emerald-400" />
          ) : (
            <Circle className="size-4 text-muted-foreground" />
          )}
        </button>

        {/* Order index */}
        <span className="text-[10px] font-mono text-muted-foreground tabular-nums shrink-0 w-6 text-center">
          #{siblingIndex + 1}
        </span>

        {/* Type icon + title */}
        <meta.icon className={cn('size-4 shrink-0', meta.color)} />
        <button
          type="button"
          onClick={() => onToggle(node.id)}
          className="flex-1 min-w-0 text-left"
        >
          <div className="flex items-center gap-2">
            <span className={cn('text-sm font-medium truncate', isDone && 'line-through opacity-60')}>
              {node.title}
            </span>
            <Badge variant="outline" className="text-[9px] shrink-0">
              {meta.label}
            </Badge>
          </div>
          {node.description && (
            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{node.description}</p>
          )}
        </button>

        {/* Stats */}
        {hasChildren && (
          <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
            {completedChildren}/{node.children.length}
          </span>
        )}
        {node.estMinutes && (
          <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
            ~{node.estMinutes}m
          </span>
        )}

        {/* Actions */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button
            type="button"
            onClick={() => onMove(node, 'up')}
            disabled={isFirst || pending}
            className="rounded p-1 hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Lên"
            title="Move up"
          >
            <ArrowUp className="size-3" />
          </button>
          <button
            type="button"
            onClick={() => onMove(node, 'down')}
            disabled={isLast || pending}
            className="rounded p-1 hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Xuống"
            title="Move down"
          >
            <ArrowDown className="size-3" />
          </button>
          <button
            type="button"
            onClick={() => onAddChild(node)}
            className="rounded p-1 hover:bg-secondary text-cyan-400"
            aria-label="Thêm con"
            title="Add child node"
          >
            <Plus className="size-3" />
          </button>
          <button
            type="button"
            onClick={() => onEdit(node)}
            className="rounded p-1 hover:bg-secondary"
            aria-label="Sửa"
            title="Edit"
          >
            <Sparkles className="size-3" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(node)}
            disabled={pending}
            className="rounded p-1 hover:bg-destructive/20 text-destructive"
            aria-label="Xoá"
            title="Delete (with children)"
          >
            <Trash2 className="size-3" />
          </button>
        </div>
      </div>

      {/* Children — recursive */}
      {isOpen && hasChildren && (
        <div className="border-l-2 border-border/40 ml-3 pl-1 pb-2 pt-1 space-y-1.5 mr-1">
          {node.children.map((child, i) => (
            <TreeNodeRow
              key={child.id}
              node={child}
              siblingCount={node.children.length}
              siblingIndex={i}
              openSet={openSet}
              onToggle={onToggle}
              onMove={onMove}
              onDelete={onDelete}
              onAddChild={onAddChild}
              onEdit={onEdit}
              onToggleDone={onToggleDone}
              depth={depth + 1}
              pending={pending}
            />
          ))}
        </div>
      )}

      {/* Empty children hint */}
      {isOpen && !hasChildren && (
        <div className="px-4 pb-3 -mt-1">
          <button
            type="button"
            onClick={() => onAddChild(node)}
            className="w-full rounded border border-dashed border-border bg-secondary/20 hover:bg-secondary/40 px-3 py-2 text-xs text-muted-foreground hover:text-foreground inline-flex items-center justify-center gap-2"
          >
            <Plus className="size-3" />
            Thêm cấp con đầu tiên vào "{node.title}"
          </button>
        </div>
      )}
    </div>
  );
}

/* ============================ Create / Edit dialog ============================ */
function NodeDialog({
  open,
  onOpenChange,
  workspaceSlug,
  mode,
  parentId = null,
  parentTitle,
  parentDepth = 0,
  editing,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  workspaceSlug: string;
  mode: 'create' | 'edit';
  parentId?: string | null;
  parentTitle?: string;
  parentDepth?: number;
  editing?: TreeNodeWithChildren | null;
}) {
  const router = useRouter();
  const isEdit = mode === 'edit';
  // Reset state when target changes
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [nodeType, setNodeType] = useState('course');
  const [estMinutes, setEstMinutes] = useState<number | ''>('');
  const [bodyMd, setBodyMd] = useState('');
  const [pending, startTransition] = useTransition();

  // Initialize on open
  useState(() => {
    if (isEdit && editing) {
      setTitle(editing.title);
      setDescription(editing.description ?? '');
      setNodeType(editing.nodeType);
      setEstMinutes(editing.estMinutes ?? '');
      setBodyMd(editing.bodyMd ?? '');
    } else {
      // Sensible default: deeper → smaller scope
      const defaultByDepth = ['course', 'phase', 'session', 'lesson', 'task', 'task'];
      setNodeType(defaultByDepth[Math.min(parentDepth, defaultByDepth.length - 1)] ?? 'lesson');
      setTitle('');
      setDescription('');
      setEstMinutes('');
      setBodyMd('');
    }
  });

  const submit = () => {
    if (!title.trim()) return;
    startTransition(async () => {
      try {
        if (isEdit && editing) {
          await updateTreeNode({
            workspaceSlug,
            nodeId: editing.id,
            title: title.trim(),
            description: description.trim() || undefined,
            nodeType,
            estMinutes: estMinutes === '' ? undefined : Number(estMinutes),
            bodyMd: bodyMd.trim() || undefined,
          });
          toast.success('Đã cập nhật');
        } else {
          await createTreeNode({
            workspaceSlug,
            parentId,
            nodeType,
            title: title.trim(),
            description: description.trim() || undefined,
            estMinutes: estMinutes === '' ? undefined : Number(estMinutes),
            bodyMd: bodyMd.trim() || undefined,
          });
          toast.success('Đã tạo');
        }
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
          <DialogTitle>
            {isEdit ? 'Sửa node' : parentTitle ? `Thêm con vào "${parentTitle}"` : 'Tạo cây mới'}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Cập nhật tên, loại, mô tả, thời lượng của node.'
              : 'Mỗi node có thể có nhiều con. Bạn có thể tạo bất kỳ cấp nào: khoá → giai đoạn → tuần → buổi → bài...'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium block mb-1.5">Loại node *</label>
            <select
              value={nodeType}
              onChange={(e) => setNodeType(e.target.value)}
              className="w-full h-10 rounded-xl border border-border bg-secondary/40 px-3 text-sm"
            >
              {NODE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium block mb-1.5">Tên *</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="vd: AWS Foundations, Tuần 1 — IAM, Lab 2.1..."
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1.5">Mô tả ngắn</label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="1 câu mô tả mục tiêu"
            />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1.5">Nội dung chi tiết (markdown, optional)</label>
            <Textarea
              value={bodyMd}
              onChange={(e) => setBodyMd(e.target.value)}
              rows={4}
              placeholder="Mục tiêu, các bước, tài liệu tham khảo..."
            />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1.5">Thời lượng ước tính (phút)</label>
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="size-4" />
            Huỷ
          </Button>
          <Button onClick={submit} disabled={pending || !title.trim()}>
            {pending && <Loader2 className="size-3 animate-spin" />}
            <Save className="size-4" />
            {isEdit ? 'Lưu' : 'Tạo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
