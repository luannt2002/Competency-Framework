/**
 * AuditRow — client component for a single row in the audit log table.
 * Owns a local "expanded" state so before/after JSON can be inspected inline.
 */
'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

export type AuditRowData = {
  id: string;
  createdAt: string;
  actorUserId: string | null;
  actorRole: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  before: unknown;
  after: unknown;
};

function shortId(id: string | null): string {
  if (!id) return '—';
  if (id.length <= 10) return id;
  return `${id.slice(0, 4)}…${id.slice(-4)}`;
}

function safeStringify(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function AuditRow({ row }: { row: AuditRowData }) {
  const [open, setOpen] = useState(false);
  const hasDiff =
    (row.before !== null && row.before !== undefined) ||
    (row.after !== null && row.after !== undefined);

  return (
    <>
      <tr className="border-t border-border hover:bg-secondary/20">
        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
          {new Date(row.createdAt).toLocaleString()}
        </td>
        <td
          className="px-4 py-3 text-xs"
          style={{ fontFamily: 'var(--font-jetbrains), monospace' }}
        >
          {shortId(row.actorUserId)}
        </td>
        <td className="px-4 py-3">
          <span className="inline-flex items-center rounded-md bg-secondary/60 px-2 py-0.5 text-[11px] font-medium text-foreground/80">
            {row.actorRole ?? '—'}
          </span>
        </td>
        <td
          className="px-4 py-3 text-xs"
          style={{ fontFamily: 'var(--font-jetbrains), monospace' }}
        >
          {row.action}
        </td>
        <td className="px-4 py-3 text-xs text-muted-foreground">{row.resourceType}</td>
        <td
          className="px-4 py-3 text-xs"
          style={{ fontFamily: 'var(--font-jetbrains), monospace' }}
        >
          {shortId(row.resourceId)}
        </td>
        <td className="px-4 py-3 text-right">
          {hasDiff ? (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary/40 px-2 py-1 text-[11px] font-medium text-foreground/80 hover:bg-secondary"
            >
              {open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
              {open ? 'Hide' : 'View'}
            </button>
          ) : (
            <span className="text-[11px] text-muted-foreground">—</span>
          )}
        </td>
      </tr>
      {open && hasDiff && (
        <tr className="bg-secondary/10">
          <td colSpan={7} className="px-4 py-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                  Before
                </div>
                <pre
                  className="rounded-md bg-card border border-border p-3 text-[11px] overflow-x-auto"
                  style={{ fontFamily: 'var(--font-jetbrains), monospace' }}
                >
                  {safeStringify(row.before)}
                </pre>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                  After
                </div>
                <pre
                  className="rounded-md bg-card border border-border p-3 text-[11px] overflow-x-auto"
                  style={{ fontFamily: 'var(--font-jetbrains), monospace' }}
                >
                  {safeStringify(row.after)}
                </pre>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
