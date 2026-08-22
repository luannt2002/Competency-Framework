'use client';

/**
 * Hàng đợi duyệt bằng chứng — nằm cạnh hàng đợi chấm bài trên `/grading`.
 *
 * Mỗi dòng là một bằng chứng người học nộp cho một kỹ năng, chưa ai duyệt.
 * Duyệt → `level_source = 'verified'` + 30 XP; Từ chối → chỉ ghi lại quyết định.
 * Không hiện bằng chứng của chính người đang xem: server từ chối tự duyệt, nên
 * hiện ra rồi mới báo lỗi là hàng đợi nói dối.
 */
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Check, ExternalLink, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { verifyEvidence } from '@/actions/evidence';

export type EvidenceItem = {
  gradeId: string;
  displayName: string;
  skillName: string;
  levelCode: string | null;
  kind: string;
  score: number;
  evidenceUrl: string | null;
  note: string | null;
  createdAtLabel: string;
};

export function EvidenceReviewQueue({
  workspaceSlug,
  items,
}: {
  workspaceSlug: string;
  items: EvidenceItem[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [settled, setSettled] = useState<Set<string>>(new Set());

  const remaining = items.filter((i) => !settled.has(i.gradeId));

  const decide = (gradeId: string, approved: boolean) => {
    setBusyId(gradeId);
    startTransition(async () => {
      try {
        await verifyEvidence({ workspaceSlug, gradeId, approved });
        setSettled((prev) => new Set(prev).add(gradeId));
        toast.success(approved ? 'Đã duyệt bằng chứng' : 'Đã từ chối bằng chứng', {
          description: approved ? 'Kỹ năng chuyển sang trạng thái đã xác minh (+30 XP).' : undefined,
        });
        router.refresh();
      } catch (e) {
        const raw = e instanceof Error ? e.message : String(e);
        toast.error('Không xử lý được', {
          description:
            raw === 'CANNOT_VERIFY_OWN_EVIDENCE'
              ? 'Không thể tự duyệt bằng chứng của chính mình.'
              : raw,
        });
      } finally {
        setBusyId(null);
      }
    });
  };

  if (remaining.length === 0) {
    return (
      <EmptyState
        title="Không có bằng chứng nào chờ duyệt"
        description="Khi người học gắn bằng chứng cho một kỹ năng, nó sẽ xuất hiện ở đây."
      />
    );
  }

  return (
    <ul className="space-y-3">
      {remaining.map((it) => {
        const busy = busyId === it.gradeId && pending;
        return (
          <li key={it.gradeId} className="surface p-4 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium">
                  {it.skillName}
                  {it.levelCode && (
                    <span className="ml-2 tag">{it.levelCode}</span>
                  )}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {it.displayName} · {it.kind} · điểm {it.score} · {it.createdAtLabel}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => decide(it.gradeId, false)}
                >
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
                  Từ chối
                </Button>
                <Button size="sm" disabled={busy} onClick={() => decide(it.gradeId, true)}>
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                  Duyệt
                </Button>
              </div>
            </div>

            {it.evidenceUrl && (
              <a
                href={it.evidenceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex max-w-full items-center gap-1.5 break-all text-sm text-primary hover:underline"
              >
                <ExternalLink className="size-3.5 shrink-0" aria-hidden="true" />
                {it.evidenceUrl}
              </a>
            )}
            {it.note && (
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">{it.note}</p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
