'use client';

/**
 * ImportWizard — paste a PHASE markdown file → tree nodes.
 * Parses server-side (parseMarkdownPhaseText); result card links to the
 * freshly created phase root node.
 */
import { useState, useTransition } from 'react';
import Link from 'next/link';
import { FileUp, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { importMarkdownPhase } from '@/actions/framework-import';
import { toast } from 'sonner';

export function ImportWizard({ workspaceSlug }: { workspaceSlug: string }) {
  const [md, setMd] = useState('');
  const [result, setResult] = useState<{ phaseTitle: string; weeksImported: number; rootSlug: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      try {
        const r = await importMarkdownPhase(workspaceSlug, md);
        setResult(r);
        toast.success(`Đã import "${r.phaseTitle}" (${r.weeksImported} tuần)`);
      } catch (e) {
        toast.error(
          e instanceof Error && e.message === 'INGESTION_VALIDATION_FAILED'
            ? 'Markdown không hợp lệ — không tìm thấy tuần nào (### WEEK N ...)'
            : `Import thất bại: ${e instanceof Error ? e.message : 'lỗi không rõ'}`,
        );
      }
    });
  }

  if (result) {
    return (
      <div className="surface p-6 text-center space-y-4">
        <CheckCircle2 className="size-10 text-emerald-500 mx-auto" />
        <div>
          <h3 className="font-semibold text-lg">{result.phaseTitle}</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Đã import {result.weeksImported} tuần vào cây học tập.
          </p>
        </div>
        <Button asChild className="btn-brand border-0">
          <Link href={`/w/${workspaceSlug}/n/${result.rootSlug}`}>
            Mở phase vừa import <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground leading-relaxed">
        Dán nội dung file markdown phase (chuẩn{' '}
        <code className="rounded bg-secondary px-1 py-0.5"># PHASE</code> /{' '}
        <code className="rounded bg-secondary px-1 py-0.5">### WEEK N</code> — giống các file{' '}
        02_PHASE…05_PHASE). Hệ thống sẽ tạo 1 node giai đoạn + các node tuần kèm mục tiêu,
        keywords, labs, tài liệu.
      </p>
      <textarea
        value={md}
        onChange={(e) => setMd(e.target.value)}
        placeholder="# 🟢 PHASE 1 — Q1 (Tháng 1–3)&#10;## AWS Deep Dive...&#10;### 🗓️ **WEEK 1 — Title**&#10;#### Main Topics&#10;- ..."
        rows={12}
        aria-label="Markdown framework"
        className="w-full rounded-xl border border-border bg-background p-3 font-mono text-xs leading-relaxed outline-none focus:border-primary/50"
      />
      <div className="flex justify-end">
        <Button onClick={run} disabled={pending || md.trim().length < 50} className="btn-brand border-0">
          {pending ? (
            'Đang import…'
          ) : (
            <>
              <FileUp className="size-4" /> Import markdown
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
