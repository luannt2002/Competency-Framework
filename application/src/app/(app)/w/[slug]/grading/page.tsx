/**
 * /w/[slug]/grading — manual grading queue (EDITOR+).
 *
 * Server Component. Everything an essay or rubric exercise needs a human for
 * lands here: attempts sitting at `status = 'pending_review'`, oldest first.
 *
 * Access is EDITOR+ via `resolveWorkspace`, which fails closed — a missing
 * workspace and an insufficient role raise the same error, so the slug space
 * can't be enumerated from this page. Non-editors are redirected to the
 * workspace home rather than shown a 403.
 */
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ClipboardCheck, Inbox, Settings2 } from 'lucide-react';
import { RBAC_LEVELS } from '@/lib/rbac/levels';
import { resolveWorkspace } from '@/lib/rbac/resolve';
import { listPendingAttempts, countPendingAttempts } from '@/lib/exercises/grading';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { StatChip } from '@/components/learn/stat-chip';
import { GradingQueue, type GradingItem } from '@/components/exercises/grading-queue';
import {
  EvidenceReviewQueue,
  type EvidenceItem,
} from '@/components/evidence/evidence-review-queue';
import { listPendingEvidence, countPendingEvidence } from '@/lib/evidence/review-queue';
import { getUsersDisplay } from '@/lib/auth/user-display';
import { formatDateVN } from '@/lib/format-date';

export default async function GradingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let ctx;
  try {
    ctx = await resolveWorkspace(slug, RBAC_LEVELS.EDITOR);
  } catch {
    redirect(`/w/${slug}`);
  }
  const { ws } = ctx;

  const [items, total, evidence, evidenceTotal] = await Promise.all([
    listPendingAttempts(ws.id, 50),
    countPendingAttempts(ws.id),
    // Bằng chứng kỹ năng cũng là "thứ đang chờ người có quyền xử lý" — cùng
    // trang, cùng cấp quyền. `verifyEvidence` có đủ logic từ lâu nhưng chưa có
    // màn nào nhìn thấy được đồ của NGƯỜI KHÁC (rà D4.7).
    listPendingEvidence(ws.id, ctx.user.id, 50),
    countPendingEvidence(ws.id, ctx.user.id),
  ]);

  const evidenceNames = await getUsersDisplay(evidence.map((e) => e.userId));
  const evidenceData: EvidenceItem[] = evidence.map((e) => ({
    gradeId: e.gradeId,
    displayName: evidenceNames.get(e.userId)?.displayName ?? e.userId,
    skillName: e.skillName,
    levelCode: e.levelCode,
    kind: e.kind,
    score: e.score,
    evidenceUrl: e.evidenceUrl,
    note: e.note,
    createdAtLabel: formatDateVN(e.createdAt),
  }));

  // `listPendingAttempts` already sanitized every payload; only the fields the
  // card renders cross into the client bundle.
  const data: GradingItem[] = items.map((i) => ({
    attemptId: i.attemptId,
    exerciseId: i.exerciseId,
    lessonTitle: i.lessonTitle,
    userId: i.userId,
    kind: i.kind,
    typeLabel: i.typeLabel,
    engine: i.engine,
    promptMd: i.promptMd,
    answer: i.answer,
    criteria: i.criteria,
    xpAward: i.xpAward,
    submittedAt: i.submittedAt,
  }));

  return (
    <div
      className="mx-auto max-w-6xl space-y-8 p-6 md:p-10"
      style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
    >
      <header className="flex flex-wrap items-center gap-4">
        <div className="accent-gradient flex size-12 items-center justify-center rounded-2xl">
          <ClipboardCheck className="size-6 text-white" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Chấm bài</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {ws.name} · bài tự luận và rubric đang chờ người chấm, cũ nhất trước.
          </p>
        </div>
        <Button asChild variant="outline" className="ml-auto">
          <Link href={`/w/${ws.slug}/grading/types`}>
            <Settings2 className="size-4" aria-hidden />
            Dạng bài
          </Link>
        </Button>
      </header>

      <section className="grid max-w-2xl grid-cols-2 gap-3 md:grid-cols-3">
        {/* Semantic tokens only: "waiting" is muted, "shown" is the brand
            primary. No ad-hoc palette — see node-card.tsx for the house style. */}
        <StatChip
          icon={Inbox}
          label="Đang chờ"
          value={String(total)}
          sub="bài"
          color="text-muted-foreground"
        />
        <StatChip
          icon={ClipboardCheck}
          label="Hiển thị"
          value={String(data.length)}
          sub="bài trên trang"
          color="text-primary"
        />
      </section>

      {data.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Không có bài nào chờ chấm"
          description="Bài tự luận hoặc rubric khi được nộp sẽ xuất hiện ở đây."
          action={
            <Button asChild variant="outline">
              <Link href={`/w/${ws.slug}/grading/types`}>Xem các dạng bài</Link>
            </Button>
          }
        />
      ) : (
        <GradingQueue workspaceSlug={ws.slug} items={data} />
      )}

      <section className="space-y-4">
        <div className="flex flex-wrap items-center gap-3 border-b border-border pb-3">
          <h2 className="text-lg font-semibold tracking-tight">Bằng chứng kỹ năng chờ duyệt</h2>
          <span className="tag tabular-nums">{evidenceTotal}</span>
          <p className="w-full text-sm text-muted-foreground sm:w-auto">
            Duyệt thì kỹ năng chuyển sang <strong>đã xác minh</strong> và người học
            nhận 30 XP. Không hiện bằng chứng của chính bạn.
          </p>
        </div>
        <EvidenceReviewQueue workspaceSlug={ws.slug} items={evidenceData} />
      </section>
    </div>
  );
}
