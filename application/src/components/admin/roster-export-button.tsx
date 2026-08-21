/**
 * RosterExportButton — D3.6/D3.7 admin export triggers (EDITOR+ server-gated).
 *
 * Excel: one row per member with per-phase done/total + %.
 * Report: printable HTML overview (member table + phase heatmap) — same
 * print-to-PDF convention as the skills export menu.
 */
'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Sheet, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { exportRosterXlsx, exportRosterReport } from '@/actions/exports';

function triggerDownload(filename: string, base64: string, mime: string) {
  const link = document.createElement('a');
  link.href = `data:${mime};base64,${base64}`;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function RosterExportButton({ workspaceSlug }: { workspaceSlug: string }) {
  const [busy, setBusy] = useState<'xlsx' | 'html' | null>(null);

  const handle = async (fmt: 'xlsx' | 'html') => {
    setBusy(fmt);
    try {
      const res =
        fmt === 'xlsx'
          ? await exportRosterXlsx(workspaceSlug)
          : await exportRosterReport(workspaceSlug);
      const mime =
        fmt === 'xlsx'
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'text/html';
      triggerDownload(res.filename, res.base64, mime);
      toast.success(`Downloaded ${res.filename}`);
    } catch (e) {
      toast.error('Roster export failed', { description: String(e) });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" onClick={() => handle('xlsx')} disabled={busy !== null}>
        {busy === 'xlsx' ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Sheet className="size-4" />
        )}
        Excel (per member)
      </Button>
      <Button variant="outline" size="sm" onClick={() => handle('html')} disabled={busy !== null}>
        {busy === 'html' ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <FileText className="size-4" />
        )}
        Overview report (print → PDF)
      </Button>
    </div>
  );
}
