/**
 * /w/[slug]/certificate/[memberId] — Printable completion certificate.
 *
 * Server Component, OWNER-only. Resolves the member (either the workspace
 * owner — `memberId` equal to workspaces.owner_user_id — or a row in
 * workspace_members). Computes total descendant nodes across all top-level
 * phases and the member's done count. Renders an A4-sized HTML certificate
 * only when completion >= 80%.
 *
 * `@media print` hides the surrounding app shell so File→Print produces a
 * single clean A4 page. The "Print / Save as PDF" button uses window.print()
 * via a tiny client component (`PrintButton`).
 */
import { redirect } from 'next/navigation';
import { and, count, eq, inArray } from 'drizzle-orm';
import { Award, Printer } from 'lucide-react';
import { db } from '@/lib/db/client';
import {
  workspaces,
  workspaceMembers,
  roadmapTreeNodes,
  userNodeProgress,
} from '@/lib/db/schema';
import { requireUser } from '@/lib/auth/supabase-server';
import { RBAC_LEVELS } from '@/lib/rbac/levels';
import { requireMinLevel, RBACError } from '@/lib/rbac/server';
import { PrintButton } from '@/components/admin/print-button';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function shortId(id: string): string {
  if (id.length <= 12) return id;
  return `${id.slice(0, 6)}…${id.slice(-6)}`;
}

function formatVnDate(d: Date): string {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export default async function CertificatePage({
  params,
}: {
  params: Promise<{ slug: string; memberId: string }>;
}) {
  const { slug, memberId } = await params;
  await requireUser();

  // Basic shape guard — memberId is either the owner's user_id (uuid) or a
  // workspace_members.id (also uuid). Either way we expect uuid format.
  if (!UUID_RE.test(memberId)) redirect(`/w/${slug}/members`);

  const wsRows = await db
    .select({
      id: workspaces.id,
      slug: workspaces.slug,
      name: workspaces.name,
      ownerUserId: workspaces.ownerUserId,
    })
    .from(workspaces)
    .where(eq(workspaces.slug, slug))
    .limit(1);
  const ws = wsRows[0];
  if (!ws) redirect('/');

  // OWNER-only.
  try {
    await requireMinLevel(ws.id, RBAC_LEVELS.OWNER);
  } catch (err) {
    if (err instanceof RBACError) redirect(`/w/${ws.slug}`);
    throw err;
  }

  // Resolve the certificate subject:
  //   - if memberId == workspaces.owner_user_id → the owner row
  //   - else look up workspace_members.id
  let subjectUserId: string;
  let subjectRole: string;
  if (memberId === ws.ownerUserId) {
    subjectUserId = ws.ownerUserId;
    subjectRole = 'workspace_owner';
  } else {
    const mRows = await db
      .select({ userId: workspaceMembers.userId, role: workspaceMembers.role })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.id, memberId),
          eq(workspaceMembers.workspaceId, ws.id),
        ),
      )
      .limit(1);
    const m = mRows[0];
    if (!m) redirect(`/w/${ws.slug}/members`);
    subjectUserId = m.userId;
    subjectRole = m.role;
  }

  // Fetch the descendant-node id set so the done count uses the same
  // denominator as the roster page (top-level phases / roots excluded).
  const allNodes = await db
    .select({ id: roadmapTreeNodes.id, pathStr: roadmapTreeNodes.pathStr })
    .from(roadmapTreeNodes)
    .where(eq(roadmapTreeNodes.workspaceId, ws.id));
  const descendantIds = allNodes
    .filter((n) => n.pathStr && n.pathStr.length > 0)
    .map((n) => n.id);

  let doneCount = 0;
  if (descendantIds.length > 0) {
    const dr = await db
      .select({ n: count() })
      .from(userNodeProgress)
      .where(
        and(
          eq(userNodeProgress.workspaceId, ws.id),
          eq(userNodeProgress.userId, subjectUserId),
          eq(userNodeProgress.status, 'done'),
          inArray(userNodeProgress.nodeId, descendantIds),
        ),
      );
    doneCount = Number(dr[0]?.n ?? 0);
  }
  const total = descendantIds.length;

  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;
  const eligible = pct >= 80;
  const issuedAt = new Date();

  return (
    <div
      className="min-h-dvh bg-muted/30 print-host"
      style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
    >
      {/* Print-only CSS — hides the surrounding app shell (sidebar + topbar) so
          the printout is a clean single A4 sheet. */}
      <style>{`
        @media print {
          @page { size: A4; margin: 0; }
          html, body { background: #fffaf3 !important; }
          /* Hide anything outside the certificate sheet */
          body * { visibility: hidden !important; }
          .cert-sheet, .cert-sheet * { visibility: visible !important; }
          .cert-sheet {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
          }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="no-print sticky top-0 z-20 flex items-center justify-between gap-3 px-6 py-3 border-b border-border bg-background/80 backdrop-blur">
        <div className="flex items-center gap-2.5">
          <Award className="size-5 text-amber-500" />
          <h1 className="text-base font-semibold">Chứng nhận hoàn thành</h1>
          <span className="text-xs text-muted-foreground">
            {ws.name} · {shortId(subjectUserId)}
          </span>
        </div>
        {eligible && (
          <PrintButton>
            <Printer className="size-4" />
            Print / Save as PDF
          </PrintButton>
        )}
      </div>

      <div className="mx-auto py-10 flex justify-center">
        {!eligible ? (
          <div className="rounded-2xl border border-border bg-card p-10 max-w-xl text-center space-y-3">
            <div className="size-14 mx-auto rounded-full bg-amber-500/15 flex items-center justify-center">
              <Award className="size-7 text-amber-500" />
            </div>
            <h2 className="text-xl font-bold">Chưa đủ điều kiện</h2>
            <p className="text-sm text-muted-foreground">
              Thành viên này mới hoàn thành <strong>{pct}%</strong> lộ trình. Cần
              đạt tối thiểu <strong>80%</strong> để cấp chứng nhận.
            </p>
            <p className="text-xs text-muted-foreground">
              ({doneCount} / {total} nodes done)
            </p>
            <p className="text-[10px] text-muted-foreground">
              User:{' '}
              <span
                className="font-mono"
                style={{ fontFamily: 'var(--font-jetbrains), monospace' }}
              >
                {subjectUserId}
              </span>{' '}
              · {subjectRole}
            </p>
          </div>
        ) : (
          <CertificateSheet
            workspaceName={ws.name}
            subjectUserId={subjectUserId}
            pct={pct}
            done={doneCount}
            total={total}
            issuedAt={issuedAt}
          />
        )}
      </div>
    </div>
  );
}

/** A4 certificate sheet (210mm × 297mm). Pure presentational. */
function CertificateSheet({
  workspaceName,
  subjectUserId,
  pct,
  done,
  total,
  issuedAt,
}: {
  workspaceName: string;
  subjectUserId: string;
  pct: number;
  done: number;
  total: number;
  issuedAt: Date;
}) {
  const initial = workspaceName.charAt(0).toUpperCase();
  return (
    <div
      className="cert-sheet relative overflow-hidden shadow-2xl"
      style={{
        width: '210mm',
        height: '297mm',
        background:
          'linear-gradient(160deg, #fffaf3 0%, #fff3e3 60%, #ffe7cf 100%)',
        color: '#3a2a1c',
        fontFamily: 'var(--font-outfit), sans-serif',
      }}
    >
      {/* Decorative corner ornaments */}
      <div
        aria-hidden
        className="absolute"
        style={{
          top: '10mm',
          left: '10mm',
          right: '10mm',
          bottom: '10mm',
          border: '2px solid rgba(255, 122, 89, 0.35)',
          borderRadius: '4mm',
        }}
      />
      <div
        aria-hidden
        className="absolute"
        style={{
          top: '13mm',
          left: '13mm',
          right: '13mm',
          bottom: '13mm',
          border: '1px solid rgba(255, 122, 89, 0.6)',
          borderRadius: '3mm',
        }}
      />

      <div className="absolute inset-0 flex flex-col items-center px-12 pt-16 pb-12">
        {/* Ribbon-style title */}
        <div
          className="relative inline-flex items-center justify-center"
          style={{ marginTop: '14mm' }}
        >
          <div
            style={{
              padding: '8px 32px',
              background: 'linear-gradient(90deg, #ff7a59 0%, #ff5a3a 100%)',
              color: 'white',
              borderRadius: '999px',
              fontSize: '14px',
              fontWeight: 600,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              boxShadow: '0 8px 24px rgba(255, 90, 58, 0.35)',
            }}
          >
            Chứng nhận hoàn thành
          </div>
        </div>

        <p
          style={{
            marginTop: '14mm',
            fontSize: '14px',
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: '#7d5b3f',
          }}
        >
          Trao tặng cho
        </p>

        {/* Subject name (user_id for MVP — no profile system yet) */}
        <h2
          style={{
            marginTop: '6mm',
            fontFamily: 'var(--font-fraunces, serif), Georgia, serif',
            fontSize: '36px',
            fontWeight: 700,
            color: '#2a1a0c',
            textAlign: 'center',
            lineHeight: 1.1,
            wordBreak: 'break-all',
          }}
        >
          {subjectUserId}
        </h2>

        <div
          aria-hidden
          style={{
            width: '60mm',
            height: '2px',
            background:
              'linear-gradient(90deg, transparent 0%, rgba(255, 122, 89, 0.7) 50%, transparent 100%)',
            marginTop: '8mm',
          }}
        />

        <p
          style={{
            marginTop: '10mm',
            fontSize: '15px',
            textAlign: 'center',
            color: '#4a3826',
            maxWidth: '140mm',
            lineHeight: 1.55,
          }}
        >
          Đã hoàn thành lộ trình{' '}
          <strong style={{ color: '#2a1a0c' }}>{workspaceName}</strong>{' '}
          với tỉ lệ <strong style={{ color: '#ff5a3a' }}>{pct}%</strong>{' '}
          ({done} / {total} nội dung).
        </p>

        <p
          style={{
            marginTop: '8mm',
            fontSize: '13px',
            color: '#7d5b3f',
          }}
        >
          Ngày cấp: <strong>{formatVnDate(issuedAt)}</strong>
        </p>

        {/* Footer */}
        <div
          className="absolute left-0 right-0 px-16 flex items-end justify-between"
          style={{ bottom: '24mm' }}
        >
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                width: '50mm',
                borderBottom: '1px solid #7d5b3f',
                marginBottom: '4px',
              }}
            />
            <div style={{ fontSize: '11px', color: '#7d5b3f' }}>
              Workspace owner
            </div>
          </div>

          <div
            style={{
              width: '20mm',
              height: '20mm',
              borderRadius: '6mm',
              background:
                'linear-gradient(135deg, #ff7a59 0%, #ff5a3a 100%)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '22px',
              fontWeight: 700,
              boxShadow: '0 6px 16px rgba(255, 90, 58, 0.35)',
            }}
          >
            {initial}
          </div>
        </div>
      </div>
    </div>
  );
}
