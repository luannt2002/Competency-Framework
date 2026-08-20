'use client';

/**
 * Create-first-node page — shown when a workspace has no tree nodes yet.
 * Linked from the empty-state CTA on /w/[slug].
 *
 * Root node (parentId = null). After creation, redirect to /w/[slug] where
 * the dashboard will render the new tree.
 */
import { useTransition, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Loader2, Save, ArrowLeft, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { createTreeNode } from '@/actions/tree-nodes';
import { NODE_TYPE_OPTIONS } from '@/lib/tree/node-meta';

export default function NewRootNodePage() {
  const router = useRouter();
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [nodeType, setNodeType] = useState('course');
  const [bodyMd, setBodyMd] = useState('');
  const [pending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    startTransition(async () => {
      try {
        await createTreeNode({
          workspaceSlug: slug,
          parentId: null,
          nodeType,
          title: title.trim(),
          description: description.trim() || undefined,
          bodyMd: bodyMd.trim() || undefined,
        });
        toast.success('Đã tạo node gốc');
        router.push(`/w/${slug}`);
        router.refresh();
      } catch (e) {
        toast.error('Lỗi tạo node', { description: String(e) });
      }
    });
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <Link
        href={`/w/${slug}`}
        className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="size-4" />
        Quay lại workspace
      </Link>

      <div className="surface p-8 shadow-sm">
        <div className="size-12 rounded-2xl accent-gradient flex items-center justify-center mb-5 shadow-lg shadow-cyan-500/20">
          <BookOpen className="size-6 text-white" />
        </div>

        <h1 className="text-2xl font-bold tracking-tight">Tạo cây học tập</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Đây là node gốc — cấp cao nhất của lộ trình. Bạn có thể thêm các bước con sau.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1.5 text-foreground/80">
              Loại node *
            </label>
            <select
              value={nodeType}
              onChange={(e) => setNodeType(e.target.value)}
              className="w-full h-10 rounded-xl border border-border bg-secondary/40 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {NODE_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.emoji} {o.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5 text-foreground/80">
              Tên lộ trình *
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="vd: DevOps Mastery 2026, Học Java từ đầu, Toán cao cấp..."
              autoFocus
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5 text-foreground/80">
              Mô tả ngắn
            </label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Lộ trình này dành cho ai, mục tiêu gì..."
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5 text-foreground/80">
              Nội dung chi tiết{' '}
              <span className="text-muted-foreground font-normal">(markdown, tuỳ chọn)</span>
            </label>
            <Textarea
              value={bodyMd}
              onChange={(e) => setBodyMd(e.target.value)}
              rows={5}
              placeholder={`## Mục tiêu\n- ...\n\n## Yêu cầu trước\n- ...`}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={pending || !title.trim()} className="flex-1">
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              Tạo lộ trình
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push(`/w/${slug}`)}
              disabled={pending}
            >
              Huỷ
            </Button>
          </div>
        </form>
      </div>

      <p className="mt-6 text-xs text-muted-foreground text-center">
        Sau khi tạo, bạn có thể thêm giai đoạn, tuần, bài học... vào bên trong node này.
      </p>
    </div>
  );
}
