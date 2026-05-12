/**
 * BulkInviteCsv — paste a CSV of `user_id,role` lines and invite many at once.
 *
 * Renders a textarea, a parsed preview table (with per-row validation), and an
 * "Invite all" button that calls the `bulkInviteMembers` server action. The
 * action loops with ON CONFLICT DO NOTHING so duplicates are skipped silently;
 * each successful insert produces a `member.invite_bulk` audit row.
 *
 * Roles accepted (canonical or short alias):
 *   learner | contributor (=workspace_contributor) | editor (=workspace_editor)
 * Header `user_id,role` is optional (auto-detected by first column literal).
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ParsedRow = {
  line: number;
  userId: string;
  roleRaw: string;
  role: BulkInviteRowInput['role'] | null;
  error: string | null;
};

/** Map any accepted role alias → canonical workspace_members.role value. */
function normalizeRole(raw: string): BulkInviteRowInput['role'] | null {
  const r = raw.trim().toLowerCase();
  if (r === 'learner') return 'learner';
  if (r === 'contributor' || r === 'workspace_contributor') return 'workspace_contributor';
  if (r === 'editor' || r === 'workspace_editor') return 'workspace_editor';
  return null;
}

function parseCsv(text: string): ParsedRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'));
  if (lines.length === 0) return [];

  // Detect header: literal "user_id" in the first column.
  const first = lines[0]!.split(',').map((s) => s.trim().toLowerCase());
  const body = first[0] === 'user_id' ? lines.slice(1) : lines;

  return body.map((raw, idx): ParsedRow => {
    const parts = raw.split(',').map((s) => s.trim());
    const userId = parts[0] ?? '';
    const roleRaw = parts[1] ?? '';
    const role = normalizeRole(roleRaw);

    let error: string | null = null;
    if (!UUID_RE.test(userId)) error = 'user_id is not a UUID';
    else if (!role) error = `role must be learner|contributor|editor (got "${roleRaw}")`;

    return {
      line: idx + 1,
      userId,
      roleRaw,
      role,
      error,
    };
  });
}

function shortId(id: string): string {
  if (id.length <= 10) return id;
  return `${id.slice(0, 4)}…${id.slice(-4)}`;
}

export function BulkInviteCsv({ workspaceSlug }: { workspaceSlug: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [result, setResult] = useState<BulkInviteResult | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const rows = useMemo(() => parseCsv(text), [text]);
  const validRows = rows.filter((r) => !r.error && r.role);
  const errorCount = rows.filter((r) => r.error).length;

  function submit() {
    setSubmitError(null);
    setResult(null);
    const payload: BulkInviteRowInput[] = validRows.map((r) => ({
      userId: r.userId,
      role: r.role!,
    }));
    if (payload.length === 0) {
      setSubmitError('No valid rows to invite.');
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
            Dán nhiều `user_id,role` cùng lúc
          </span>
        </span>
        {open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
      </button>

      {open && (
        <div className="border-t border-border p-5 space-y-4">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              CSV — mỗi dòng `user_id,role`. Header `user_id,role` tùy chọn.
              Vai trò hợp lệ: <code>learner</code>, <code>contributor</code>, <code>editor</code>.
            </span>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={'user_id,role\n00000000-0000-0000-0000-000000000001,learner\n00000000-0000-0000-0000-000000000002,editor'}
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
                        {r.userId ? shortId(r.userId) : <span className="text-destructive">—</span>}
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
                      row {e.index + 1}: {shortId(e.userId)} → {e.reason}
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
