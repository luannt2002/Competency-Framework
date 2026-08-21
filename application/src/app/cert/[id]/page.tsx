/**
 * /cert/[id] — public certificate verification page (audit G10/G12).
 *
 * NO AUTH. `[id]` is the certificate's `unique_code` (the secret itself):
 * anyone holding the code — e.g. from the QR printed on the A4 sheet or a
 * pasted URL — can verify the certificate. Unknown or revoked code → 404.
 *
 * Shows: code, subject display name, workspace name, completion % + counts,
 * issue date. Links to the public roadmap /share/[slug] ONLY when the
 * workspace is public-readonly (private workspaces stay undiscoverable).
 * `robots: noindex` — verification pages must not be indexed.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { Award, BadgeCheck, Map } from 'lucide-react';
import { db } from '@/lib/db/client';
import { workspaces } from '@/lib/db/schema';
import { certificates } from '@/lib/db/schema-certificates';
import { getUserDisplay } from '@/lib/auth/user-display';

const SITE_NAME = 'Competency Framework';

function formatVnDate(d: Date): string {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${d.getFullYear()}`;
}

export const metadata: Metadata = {
  title: `Xác thực chứng nhận · ${SITE_NAME}`,
  robots: { index: false, follow: false },
};

export default async function PublicCertificatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // guard-tenant-scope: allow — global-by-secret: the random unique_code IS
  // the authorization. No workspaceId is known before the lookup; the code
  // is unguessable (50 bits) and revoked certificates 404.
  const rows = await db
    .select({
      code: certificates.uniqueCode,
      pct: certificates.pct,
      doneCount: certificates.doneCount,
      totalNodes: certificates.totalNodes,
      issuedAt: certificates.issuedAt,
      revokedAt: certificates.revokedAt,
      subjectUserId: certificates.subjectUserId,
      workspaceId: certificates.workspaceId,
    })
    .from(certificates)
    .where(eq(certificates.uniqueCode, id))
    .limit(1);
  const cert = rows[0];
  if (!cert || cert.revokedAt) notFound();

  const [wsRow, subject] = await Promise.all([
    db
      .select({
        slug: workspaces.slug,
        name: workspaces.name,
        visibility: workspaces.visibility,
      })
      .from(workspaces)
      .where(eq(workspaces.id, cert.workspaceId))
      .limit(1),
    getUserDisplay(cert.subjectUserId),
  ]);
  const ws = wsRow[0];
  if (!ws) notFound();

  const isPublic = ws.visibility === 'public-readonly';

  return (
    <div
      className="min-h-dvh flex items-center justify-center px-4 py-12 bg-muted/30"
      style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
    >
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-border bg-gradient-to-r from-amber-500/10 to-transparent">
          <div className="size-11 rounded-full bg-amber-500/15 flex items-center justify-center">
            <Award className="size-6 text-amber-500" />
          </div>
          <div>
            <h1 className="text-lg font-bold">Xác thực chứng nhận</h1>
            <p className="text-xs text-muted-foreground">
              Thông tin do {SITE_NAME} cấp
            </p>
          </div>
        </div>

        {/* Facts */}
        <dl className="px-6 py-5 space-y-4 text-sm">
          <div className="flex items-start justify-between gap-4">
            <dt className="text-muted-foreground">Mã chứng nhận</dt>
            <dd
              className="font-semibold"
              style={{ fontFamily: 'var(--font-jetbrains), monospace' }}
            >
              {cert.code}
            </dd>
          </div>
          <div className="flex items-start justify-between gap-4">
            <dt className="text-muted-foreground">Người học</dt>
            <dd className="font-semibold text-right">{subject.displayName}</dd>
          </div>
          <div className="flex items-start justify-between gap-4">
            <dt className="text-muted-foreground">Lộ trình</dt>
            <dd className="font-semibold text-right">{ws.name}</dd>
          </div>
          <div className="flex items-start justify-between gap-4">
            <dt className="text-muted-foreground">Mức hoàn thành</dt>
            <dd className="font-semibold text-right">
              {cert.pct}% ({cert.doneCount} / {cert.totalNodes} nội dung)
            </dd>
          </div>
          <div className="flex items-start justify-between gap-4">
            <dt className="text-muted-foreground">Ngày cấp</dt>
            <dd className="font-semibold">{formatVnDate(cert.issuedAt)}</dd>
          </div>
        </dl>

        {/* Status + roadmap link (G12 — bridge to real progress) */}
        <div className="px-6 pb-6 space-y-3">
          <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
            <BadgeCheck className="size-4 shrink-0" />
            Chứng nhận hợp lệ — đủ điều kiện ≥80% lúc cấp.
          </div>
          {isPublic && (
            <Link
              href={`/share/${ws.slug}`}
              className="flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted transition-colors"
            >
              <Map className="size-4" />
              Xem lộ trình công khai
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
