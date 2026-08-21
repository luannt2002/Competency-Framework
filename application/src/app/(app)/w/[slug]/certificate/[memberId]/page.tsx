// guard-no-adhoc-color: allow — printable A4 certificate. Print styles are
// resolved by the browser's print engine, where the app's CSS variables and
// dark-mode class are not in play; literals keep the printed output stable.
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
import { and, eq } from 'drizzle-orm';
import QRCode from 'qrcode';
import { Award, Printer } from 'lucide-react';
import { db } from '@/lib/db/client';
import { userWorkspaceCompletion } from '@/lib/tree/completion-db';
import { workspaces, workspaceMembers } from '@/lib/db/schema';
import { issueCertificate } from '@/lib/db/certificates';
import { requireUser } from '@/lib/auth/supabase-server';
import { RBAC_LEVELS } from '@/lib/rbac/levels';
import { requireMinLevel, RBACError } from '@/lib/rbac/server';
import { PrintButton } from '@/components/admin/print-button';
import { getUserDisplay } from '@/lib/auth/user-display';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  const currentUser = await requireUser();

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

  // Access rules:
  //   1. memberId == ws.ownerUserId   → only accessible by the owner themselves
  //   2. memberId == currentUser.id   → learner viewing their own cert (self-service)
  //   3. memberId == workspaceMembers.id → owner-only (admin viewing someone else)
  let subjectUserId: string;
  let subjectRole: string;

  if (memberId === ws.ownerUserId) {
    if (currentUser.id !== ws.ownerUserId) redirect(`/w/${ws.slug}`);
    subjectUserId = ws.ownerUserId;
    subjectRole = 'workspace_owner';
  } else if (memberId === currentUser.id) {
    // Self-service: any workspace member can view their own cert
    subjectUserId = currentUser.id;
    subjectRole = 'learner';
  } else {
    // Admin path: memberId is workspace_members.id — requires OWNER level
    try {
      await requireMinLevel(ws.id, RBAC_LEVELS.OWNER);
    } catch (err) {
      if (err instanceof RBACError) redirect(`/w/${ws.slug}`);
      throw err;
    }
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

  // Mẫu số dùng CHUNG với trang share và dashboard — xem lib/tree/completion-db.ts.
  // Trước đây trang này loại node gốc ra khỏi mẫu số (164) trong khi share đếm
  // đủ (166), nên cùng một người cùng lúc: chứng nhận ghi 85%, trang share mà
  // chính chứng nhận dẫn sang lại ghi 84%.
  const { done: doneCount, total, pct } = await userWorkspaceCompletion(ws.id, subjectUserId);
  const eligible = pct >= 80;

  // G10 — an eligible view upserts the certificate row: the FIRST view fixes
  // issuedAt + uniqueCode; re-views only refresh pct/counts. The stored
  // issuedAt (not "now") is what the sheet and /cert verification show.
  let certCode: string | null = null;
  let issuedAt = new Date();
  let revokedAt: Date | null = null;
  if (eligible) {
    const cert = await issueCertificate({
      workspaceId: ws.id,
      subjectUserId,
      pct,
      doneCount,
      totalNodes: total,
    });
    certCode = cert.uniqueCode;
    issuedAt = cert.issuedAt;
    revokedAt = cert.revokedAt;
  }
  // Đã thu hồi thì `/cert/<code>` trả 404 — nhưng trang này vẫn render đủ tờ
  // chứng nhận kèm QR và mã, không dấu hiệu gì (rà G12). Một tờ in ra từ đây
  // sẽ dẫn tới một liên kết xác minh đã chết.
  const isRevoked = revokedAt !== null;

  // G8 — QR trỏ tới URL xác minh công khai, sinh SVG ở server rồi nhúng vào tờ in.
  //
  // KHÔNG có fallback `http://localhost:3000` nữa. QR in lên giấy thì không sửa
  // lại được: thiếu `NEXT_PUBLIC_APP_URL` ở production nghĩa là MỌI tờ chứng
  // nhận đã in đều trỏ về localhost vĩnh viễn. Thiếu env thì thà không in QR.
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.NODE_ENV === 'production' ? null : 'http://localhost:3000');
  const verifyUrl = certCode && appUrl && !isRevoked ? `${appUrl}/cert/${certCode}` : null;
  let qrSvg: string | null = null;
  if (verifyUrl) {
    qrSvg = await QRCode.toString(verifyUrl, {
      type: 'svg',
      margin: 0,
      errorCorrectionLevel: 'M',
      color: { dark: '#3a2a1c', light: '#00000000' },
    });
  }

  // G3 — tên thật từ Supabase Auth thay UUID, fallback shortId.
  const subjectDisplay = await getUserDisplay(subjectUserId);

  return (
    <div
      className="min-h-dvh bg-muted/30 print-host"
      style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
    >
      {/* Print-only CSS — hides the surrounding app shell (sidebar + topbar) so
          the printout is a clean single A4 sheet. */}
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 0; }
          /* Ép đúng MỘT trang. visibility:hidden chỉ giấu phần vẽ, hộp layout
             của vỏ app vẫn còn nguyên chiều cao — đo được scrollHeight 956px so
             với 794px của một trang A4 ngang, nên bản in tràn sang trang 2
             trắng trơn (rà G9). */
          html, body {
            background: #fffaf3 !important;
            width: 297mm !important;
            height: 210mm !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
          }
          .print-host { min-height: 0 !important; padding: 0 !important; }
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
        .cert-qr svg { display: block; width: 100%; height: 100%; }
      `}</style>

      <div className="no-print sticky top-0 z-20 flex items-center justify-between gap-3 px-6 py-3 border-b border-border bg-background/80 backdrop-blur">
        <div className="flex items-center gap-2.5">
          <Award className="size-5 text-amber-500" />
          <h1 className="text-base font-semibold">Chứng nhận hoàn thành</h1>
          <span className="text-xs text-muted-foreground">
            {ws.name} · {subjectDisplay.displayName}
          </span>
        </div>
        {eligible && certCode && verifyUrl && !isRevoked && (
          <div className="flex items-center gap-3">
            <span
              className="hidden md:inline text-xs text-muted-foreground"
              style={{ fontFamily: 'var(--font-jetbrains), monospace' }}
            >
              {verifyUrl}
            </span>
            <PrintButton>
              <Printer className="size-4" />
              In / Lưu PDF
            </PrintButton>
          </div>
        )}
      </div>

      {isRevoked && (
        <div
          role="alert"
          className="no-print mx-auto mt-6 max-w-2xl rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm"
        >
          <p className="font-semibold text-destructive">Chứng nhận này đã bị thu hồi</p>
          <p className="mt-1 text-muted-foreground">
            Liên kết xác minh công khai không còn hiệu lực, nên bản in sẽ không xác
            thực được. Nút in đã bị tắt.
          </p>
        </div>
      )}
      {eligible && certCode && !appUrl && (
        <div
          role="alert"
          className="no-print mx-auto mt-6 max-w-2xl rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm"
        >
          <p className="font-semibold">Chưa cấu hình địa chỉ công khai</p>
          <p className="mt-1 text-muted-foreground">
            Thiếu <code>NEXT_PUBLIC_APP_URL</code> nên không sinh được mã QR xác
            minh. Tờ in vẫn hợp lệ, chỉ thiếu QR — cấu hình rồi in lại.
          </p>
        </div>
      )}

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
              ({doneCount} / {total} nội dung đã xong)
            </p>
            <p className="text-[10px] text-muted-foreground">
              User:{' '}
              <span
                className="font-mono"
                style={{ fontFamily: 'var(--font-jetbrains), monospace' }}
              >
                {subjectDisplay.displayName}
              </span>{' '}
              · {subjectRole}
            </p>
          </div>
        ) : (
          <CertificateSheet
            workspaceName={ws.name}
            subjectUserId={subjectUserId}
            subjectName={subjectDisplay.displayName}
            pct={pct}
            done={doneCount}
            total={total}
            issuedAt={issuedAt}
            certCode={certCode}
            qrSvg={qrSvg}
          />
        )}
      </div>
    </div>
  );
}

/** A4 landscape certificate sheet (297mm × 210mm). Pure presentational. */
function CertificateSheet({
  workspaceName,
  subjectUserId: _subjectUserId,
  subjectName,
  pct,
  done,
  total,
  issuedAt,
  certCode,
  qrSvg,
}: {
  workspaceName: string;
  subjectUserId: string;
  subjectName: string;
  pct: number;
  done: number;
  total: number;
  issuedAt: Date;
  certCode: string | null;
  qrSvg: string | null;
}) {
  const initial = workspaceName.charAt(0).toUpperCase();
  return (
    <div
      className="cert-sheet relative overflow-hidden shadow-2xl"
      style={{
        width: '297mm',
        height: '210mm',
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
          style={{ marginTop: '8mm' }}
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
            marginTop: '10mm',
            fontSize: '14px',
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: '#7d5b3f',
          }}
        >
          Trao tặng cho
        </p>

        {/* Subject name — từ Supabase Auth (G3), fallback shortId */}
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
          {subjectName}
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

        {/* G8 — QR trỏ tới /cert/<code> để nhà tuyển dụng xác thực (G10/G12).
            ~16mm, góc dưới-phải, trong khung viền. QR SVG render server-side. */}
        {qrSvg && (
          <div
            className="absolute flex flex-col items-center"
            style={{ right: '20mm', bottom: '17mm', textAlign: 'center' }}
          >
            <div
              className="cert-qr bg-white rounded-[2mm] p-[1.5mm]"
              style={{ width: '16mm', height: '16mm' }}
              // Trusted server-generated SVG from the `qrcode` package.
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />
            <div
              style={{
                marginTop: '1.5mm',
                fontSize: '9px',
                color: '#7d5b3f',
                letterSpacing: '0.06em',
              }}
            >
              Quét để xác thực
            </div>
            {certCode && (
              <div
                style={{
                  marginTop: '0.5mm',
                  fontSize: '9px',
                  color: '#7d5b3f',
                  fontFamily: 'var(--font-jetbrains), monospace',
                }}
              >
                {certCode}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div
          className="absolute left-0 right-0 px-16 flex items-end justify-between"
          style={{ bottom: '18mm' }}
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
