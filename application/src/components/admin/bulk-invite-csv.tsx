/**
 * BulkInviteCsv — dán CSV `email_hoặc_user_id,role` để mời nhiều người một lượt.
 *
 * Renders a textarea, a parsed preview table (with per-row validation), and an
 * "Invite all" button that calls the `bulkInviteMembers` server action. The
 * action loops with ON CONFLICT DO NOTHING so duplicates are skipped silently;
 * each successful insert produces a `member.invite_bulk` audit row.
 *
 * Roles accepted (canonical or short alias):
 *   learner | contributor (=workspace_contributor) | editor (=workspace_editor)
 * Header tuỳ chọn, tự nhận ra qua cột đầu (`email` hoặc `user_id`).
 *
 * Cột định danh nhận CẢ email lẫn UUID. Server đã resolve email từ đợt 7
 * (`findUserIdByEmail`, và ghi invite pending nếu người đó chưa có tài khoản),
 * nhưng client vẫn chặn cứng bằng `UUID_RE` nên mọi dòng email bị gạt trước khi
 * rời trình duyệt — server chạy được mà KHÔNG có đường UI nào tới (rà D2.2:
 * POST thẳng server action với một dòng email trả `{"added":0,"invited":1}`).
 */
'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronUp, Upload, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  bulkInviteMembers,
  type BulkInviteResult,
  type BulkInviteRowInput,
} from '@/actions/workspace-members';
import { parseInviteCsv, shortIdentifier } from '@/lib/admin/parse-invite-csv';

export function BulkInviteCsv({ workspaceSlug }: { workspaceSlug: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [result, setResult] = useState<BulkInviteResult | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const rows = useMemo(() => parseInviteCsv(text), [text]);
  const validRows = rows.filter((r) => !r.error && r.role);
  const errorCount = rows.filter((r) => r.error).length;

  function submit() {
    setSubmitError(null);
    setResult(null);
    const payload: BulkInviteRowInput[] = validRows.map((r) => ({
      userId: r.identifier,
      role: r.role!,
    }));
    if (payload.length === 0) {
      setSubmitError('Không có dòng nào hợp lệ để mời.');
      return;
    }
    startTransition(async () => {
      try {
        const res = await bulkInviteMembers(workspaceSlug, payload);
        setResult(res);
        router.refresh();
      } catch (e) {
        setSubmitError(e instanceof Error ? e.message : 'BULK_INVITE_FAILED');
      }
    });
  }

  return (
    <section className="rounded-2xl border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-secondary/30 transition-colors rounded-2xl"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2.5">
          <Upload className="size-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Bulk import từ CSV</span>
          <span className="text-xs text-muted-foreground">
            Mời hàng loạt bằng CSV
          </span>
        </span>
        {open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
      </button>

      {open && (
        <div className="border-t border-border p-5 space-y-4">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              Mỗi dòng: <code>email,vai trò</code> (hoặc user_id). Dòng tiêu đề tuỳ chọn. Người chưa có tài khoản sẽ được ghi lời mời chờ, tự vào workspace khi họ đăng nhập lần đầu.
              Vai trò hợp lệ: <code>learner</code>, <code>contributor</code>, <code>editor</code>.
            </span>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={'email,role\nan@congty.vn,learner\nbinh@congty.vn,editor\n00000000-0000-0000-0000-000000000001,contributor'}
              className="font-mono text-xs min-h-[140px]"
              style={{ fontFamily: 'var(--font-jetbrains), monospace' }}
            />
          </label>

          {rows.length > 0 && (
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-secondary/40 text-muted-foreground">
                  <tr className="text-left">
                    <th className="px-3 py-2 font-medium w-10">#</th>
                    <th className="px-3 py-2 font-medium">User ID</th>
                    <th className="px-3 py-2 font-medium">Role</th>
                    <th className="px-3 py-2 font-medium">Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.line} className="border-t border-border">
                      <td className="px-3 py-1.5 text-muted-foreground tabular-nums">
                        {r.line}
                      </td>
                      <td
                        className="px-3 py-1.5 font-mono"
                        style={{ fontFamily: 'var(--font-jetbrains), monospace' }}
                      >
                        {r.identifier ? shortIdentifier(r.identifier) : <span className="text-destructive">—</span>}
                      </td>
                      <td className="px-3 py-1.5">
                        {r.role ? (
                          <span className="inline-flex items-center rounded-md bg-secondary/60 px-1.5 py-0.5 text-[10px] font-medium">
                            {r.role.replace('workspace_', '')}
                          </span>
                        ) : (
                          <span className="text-destructive font-mono text-[10px]">
                            {r.roleRaw || '—'}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-1.5">
                        {r.error ? (
                          <span className="inline-flex items-center gap-1 text-destructive">
                            <AlertCircle className="size-3" />
                            {r.error}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-emerald-500">
                            <CheckCircle2 className="size-3" />
                            ok
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {rows.length > 0 && (
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs text-muted-foreground">
                {validRows.length} hợp lệ · {errorCount} lỗi · {rows.length} dòng
              </div>
              <Button onClick={submit} disabled={pending || validRows.length === 0}>
                {pending ? 'Đang mời…' : `Invite all (${validRows.length})`}
              </Button>
            </div>
          )}

          {submitError && (
            <p className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
              {submitError}
            </p>
          )}

          {result && (
            <div className="rounded-xl border border-border bg-secondary/30 p-3 text-xs space-y-2">
              <div className="flex flex-wrap gap-3">
                <span className="text-emerald-500 font-semibold">
                  + {result.added} added
                </span>
                <span className="text-primary font-semibold">
                  {result.invited} invited (pending)
                </span>
                <span className="text-amber-500 font-semibold">
                  {result.skipped} skipped
                </span>
                <span className="text-destructive font-semibold">
                  {result.errors.length} errors
                </span>
              </div>
              {result.errors.length > 0 && (
                <ul className="space-y-0.5 list-disc list-inside text-muted-foreground">
                  {result.errors.slice(0, 10).map((e, i) => (
                    <li
                      key={i}
                      className="font-mono"
                      style={{ fontFamily: 'var(--font-jetbrains), monospace' }}
                    >
                      dòng {e.index + 1}: {shortIdentifier(e.userId)} → {e.reason}
                    </li>
                  ))}
                  {result.errors.length > 10 && (
                    <li className="italic">…{result.errors.length - 10} more</li>
                  )}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
