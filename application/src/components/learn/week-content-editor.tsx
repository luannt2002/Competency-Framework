'use client';

/**
 * Week content editor — inline add/delete for Modules (Buổi), Lessons (Bài), Labs.
 * Used inside Week Detail page. All mutations via server actions.
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  Plus,
  Loader2,
  Trash2,
  X,
  Save,
  ArrowRight,
  PlayCircle,
  CheckCircle2,
  Beaker,
  BookOpen,
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
  createModule,
  deleteModule,
  createLesson,
  deleteLesson,
  createLab,
  deleteLab,
} from '@/actions/content';

/* ============================ Types ============================ */
export type EditorLesson = {
  id: string;
  slug: string;
  title: string;
  estMinutes: number | null;
  status: 'not_started' | 'in_progress' | 'completed' | 'mastered';
};
export type EditorModule = {
  id: string;
  title: string;
  summary: string | null;
  lessons: EditorLesson[];
};
export type EditorLab = {
  id: string;
  title: string;
  description: string | null;
  estMinutes: number | null;
};

type Props = {
  workspaceSlug: string;
  levelCode: string;
  weekIndex: number;
  weekId: string;
  modules: EditorModule[];
  labs: EditorLab[];
};

export function WeekContentEditor({
  workspaceSlug,
  levelCode,
  weekIndex,
  weekId,
  modules,
  labs,
}: Props) {
  const router = useRouter();
  const [addModuleOpen, setAddModuleOpen] = useState(false);
  const [addLessonForModule, setAddLessonForModule] = useState<string | null>(null);
  const [addLabOpen, setAddLabOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const onDeleteModule = (mod: EditorModule) => {
    if (!window.confirm(`Xoá buổi "${mod.title}"? Sẽ xoá luôn ${mod.lessons.length} bài học bên trong.`)) return;
    startTransition(async () => {
      try {
        await deleteModule({ workspaceSlug, moduleId: mod.id });
        toast.success('Đã xoá buổi');
        router.refresh();
      } catch (e) {
        toast.error('Lỗi xoá', { description: String(e) });
      }
    });
  };

  const onDeleteLesson = (lesson: EditorLesson) => {
    if (!window.confirm(`Xoá bài "${lesson.title}"?`)) return;
    startTransition(async () => {
      try {
        await deleteLesson({ workspaceSlug, lessonId: lesson.id });
        toast.success('Đã xoá bài học');
        router.refresh();
      } catch (e) {
        toast.error('Lỗi xoá', { description: String(e) });
      }
    });
  };

  const onDeleteLab = (lab: EditorLab) => {
    if (!window.confirm(`Xoá lab "${lab.title}"?`)) return;
    startTransition(async () => {
      try {
        await deleteLab({ workspaceSlug, labId: lab.id });
        toast.success('Đã xoá lab');
        router.refresh();
      } catch (e) {
        toast.error('Lỗi xoá', { description: String(e) });
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* Modules (buổi) */}
      {modules.map((mod) => (
        <section key={mod.id} className="surface overflow-hidden group">
          <header className="p-4 border-b border-border bg-secondary/20 flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold">{mod.title}</h3>
              {mod.summary && <p className="text-xs text-muted-foreground mt-1">{mod.summary}</p>}
              <p className="text-[10px] text-muted-foreground mt-1">
                {mod.lessons.length} bài học
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => onDeleteModule(mod)}
              disabled={pending}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Xoá buổi"
            >
              <Trash2 className="size-3 text-destructive" />
            </Button>
          </header>

          <ul className="divide-y divide-border">
            {mod.lessons.map((l) => {
              const status =
                l.status === 'mastered'
                  ? 'mastered'
                  : l.status === 'completed'
                    ? 'completed'
                    : l.status === 'in_progress'
                      ? 'in-progress'
                      : 'todo';
              const cta =
                status === 'completed' || status === 'mastered'
                  ? 'Xem lại'
                  : status === 'in-progress'
                    ? 'Tiếp tục'
                    : 'Bắt đầu';
              return (
                <li
                  key={l.id}
                  className="flex items-center gap-3 p-4 hover:bg-secondary/20 transition-colors group/lesson"
                >
                  <StatusIcon status={status} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{l.title}</p>
                    <p className="text-xs text-muted-foreground">~{l.estMinutes ?? 8}m</p>
                  </div>
                  <Button asChild size="sm" variant={status === 'todo' ? 'default' : 'outline'}>
                    <Link
                      href={`/w/${workspaceSlug}/learn/${levelCode}/${weekIndex}/${l.slug}`}
                    >
                      {cta} <ArrowRight className="size-3" />
                    </Link>
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => onDeleteLesson(l)}
                    disabled={pending}
                    className="opacity-0 group-hover/lesson:opacity-100 transition-opacity"
                    aria-label="Xoá bài"
                  >
                    <Trash2 className="size-3 text-destructive" />
                  </Button>
                </li>
              );
            })}
            {mod.lessons.length === 0 && (
              <li className="p-4 text-xs text-muted-foreground italic">Chưa có bài học.</li>
            )}
            <li className="p-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="w-full justify-start text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setAddLessonForModule(mod.id)}
              >
                <Plus className="size-3" />
                Thêm bài học vào buổi này
              </Button>
            </li>
          </ul>
        </section>
      ))}

      {/* Add module button */}
      <div className="surface p-3 border-dashed border-cyan-500/30 bg-cyan-500/5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => setAddModuleOpen(true)}
        >
          <Plus className="size-4" />
          Thêm buổi học mới vào tuần này
        </Button>
      </div>

      {/* Labs section */}
      <section className="surface overflow-hidden">
        <header className="p-4 border-b border-border bg-secondary/20 flex items-center gap-2">
          <Beaker className="size-4 text-cyan-400" />
          <h3 className="font-semibold text-sm">Hands-on Labs</h3>
          <span className="text-xs text-muted-foreground">({labs.length})</span>
          <span className="ml-auto text-xs text-amber-400 font-mono">+50 XP / lab</span>
        </header>
        <ul className="divide-y divide-border">
          {labs.map((lab) => (
            <li
              key={lab.id}
              className="flex items-center gap-3 p-3 hover:bg-secondary/20 group/lab"
            >
              <Beaker className="size-4 text-emerald-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{lab.title}</p>
                {lab.description && (
                  <p className="text-xs text-muted-foreground line-clamp-1">{lab.description}</p>
                )}
              </div>
              <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                ~{lab.estMinutes ?? 30}m
              </span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => onDeleteLab(lab)}
                disabled={pending}
                className="opacity-0 group-hover/lab:opacity-100 transition-opacity"
                aria-label="Xoá lab"
              >
                <Trash2 className="size-3 text-destructive" />
              </Button>
            </li>
          ))}
          {labs.length === 0 && (
            <li className="p-4 text-xs text-muted-foreground italic">Chưa có lab.</li>
          )}
          <li className="p-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="w-full justify-start text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setAddLabOpen(true)}
            >
              <Plus className="size-3" />
              Thêm hands-on lab
            </Button>
          </li>
        </ul>
      </section>

      {/* Dialogs */}
      <AddModuleDialog
        open={addModuleOpen}
        onOpenChange={setAddModuleOpen}
        workspaceSlug={workspaceSlug}
        weekId={weekId}
      />
      <AddLessonDialog
        moduleId={addLessonForModule}
        onClose={() => setAddLessonForModule(null)}
        workspaceSlug={workspaceSlug}
      />
      <AddLabDialog
        open={addLabOpen}
        onOpenChange={setAddLabOpen}
        workspaceSlug={workspaceSlug}
        weekId={weekId}
      />
    </div>
  );
}

/* ============================ Add Module Dialog ============================ */
function AddModuleDialog({
  open,
  onOpenChange,
  workspaceSlug,
  weekId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  workspaceSlug: string;
  weekId: string;
}) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [pending, startTransition] = useTransition();

  const submit = () => {
    if (!title.trim()) return;
    startTransition(async () => {
      try {
        await createModule({
          workspaceSlug,
          weekId,
          title: title.trim(),
          summary: summary.trim() || undefined,
        });
        toast.success('Đã thêm buổi học');
        setTitle('');
        setSummary('');
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
          <DialogTitle>Thêm buổi học mới</DialogTitle>
          <DialogDescription>
            Buổi học là nhóm các bài học trong tuần (vd: "AWS Account Hygiene").
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium block mb-1.5">Tên buổi *</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="vd: Terraform State & Backend"
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1.5">Mô tả</label>
            <Textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Mô tả ngắn nội dung buổi này..."
              rows={3}
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
            Tạo buổi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============================ Add Lesson Dialog ============================ */
function AddLessonDialog({
  moduleId,
  onClose,
  workspaceSlug,
}: {
  moduleId: string | null;
  onClose: () => void;
  workspaceSlug: string;
}) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [introMd, setIntroMd] = useState('');
  const [estMinutes, setEstMinutes] = useState(8);
  const [pending, startTransition] = useTransition();

  const open = moduleId !== null;

  const submit = () => {
    if (!moduleId || !title.trim()) return;
    startTransition(async () => {
      try {
        await createLesson({
          workspaceSlug,
          moduleId,
          title: title.trim(),
          introMd: introMd.trim() || undefined,
          estMinutes,
        });
        toast.success('Đã thêm bài học');
        setTitle('');
        setIntroMd('');
        setEstMinutes(8);
        onClose();
        router.refresh();
      } catch (e) {
        toast.error('Lỗi tạo', { description: String(e) });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Thêm bài học mới</DialogTitle>
          <DialogDescription>
            Bài học là 1 đơn vị 5-15 phút có thể chạy trong Lesson Runner.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium block mb-1.5">Tên bài *</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="vd: Terraform Backend với S3 + DynamoDB"
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1.5">Intro (markdown)</label>
            <Textarea
              value={introMd}
              onChange={(e) => setIntroMd(e.target.value)}
              placeholder="Đoạn intro ngắn hiện ở đầu lesson runner..."
              rows={4}
            />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1.5">Thời lượng (phút)</label>
            <Input
              type="number"
              min={1}
              max={240}
              value={estMinutes}
              onChange={(e) => setEstMinutes(Number(e.target.value) || 8)}
              className="w-24"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            💡 Sau khi tạo bài, bạn có thể thêm exercise (MCQ, fill-blank, type-answer, ...)
            qua AI generate hoặc Framework Editor.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            <X className="size-4" />
            Huỷ
          </Button>
          <Button onClick={submit} disabled={pending || !title.trim()}>
            {pending && <Loader2 className="size-3 animate-spin" />}
            <Save className="size-4" />
            Tạo bài học
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============================ Add Lab Dialog ============================ */
function AddLabDialog({
  open,
  onOpenChange,
  workspaceSlug,
  weekId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  workspaceSlug: string;
  weekId: string;
}) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [bodyMd, setBodyMd] = useState('');
  const [estMinutes, setEstMinutes] = useState(30);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    if (!title.trim()) return;
    startTransition(async () => {
      try {
        await createLab({
          workspaceSlug,
          weekId,
          title: title.trim(),
          description: description.trim() || undefined,
          bodyMd: bodyMd.trim() || undefined,
          estMinutes,
        });
        toast.success('Đã thêm lab');
        setTitle('');
        setDescription('');
        setBodyMd('');
        setEstMinutes(30);
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
          <DialogTitle className="flex items-center gap-2">
            <Beaker className="size-5 text-cyan-400" />
            Thêm Hands-on Lab
          </DialogTitle>
          <DialogDescription>
            Lab là task thực hành (vd: deploy infra, viết code thật). +50 XP khi hoàn thành.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium block mb-1.5">Tên lab *</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="vd: Lab 2.1 — Bootstrap S3+DynamoDB backend"
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1.5">Mô tả ngắn</label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="1 câu mô tả..."
            />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1.5">Nội dung chi tiết (markdown)</label>
            <Textarea
              value={bodyMd}
              onChange={(e) => setBodyMd(e.target.value)}
              placeholder="Các bước cần làm, deliverables..."
              rows={6}
            />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1.5">Thời lượng (phút)</label>
            <Input
              type="number"
              min={1}
              max={480}
              value={estMinutes}
              onChange={(e) => setEstMinutes(Number(e.target.value) || 30)}
              className="w-24"
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
            Tạo lab
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============================ helpers ============================ */
function StatusIcon({ status }: { status: 'todo' | 'in-progress' | 'completed' | 'mastered' }) {
  if (status === 'mastered') return <CheckCircle2 className="size-5 text-violet-400" />;
  if (status === 'completed') return <CheckCircle2 className="size-5 text-emerald-400" />;
  if (status === 'in-progress') return <PlayCircle className="size-5 text-cyan-400" />;
  return <BookOpen className="size-5 text-muted-foreground" />;
}
