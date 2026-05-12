'use client';

/**
 * Export menu — triggers server actions returning base64 buffers, then
 * downloads them client-side.
 */

import { useState } from 'react';
import { toast } from 'sonner';
import { FileText, Sheet, Code2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { exportXlsx, exportJson, exportHtmlReport } from '@/actions/exports';

type Format = 'xlsx' | 'json' | 'html';

function triggerDownload(filename: string, base64: string, mime: string) {
  const link = document.createElement('a');
  link.href = `data:${mime};base64,${base64}`;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function ExportMenu({ workspaceSlug }: { workspaceSlug: string }) {
  const [busy, setBusy] = useState<Format | null>(null);

  const handle = async (fmt: Format) => {
    setBusy(fmt);
    try {
      let res: { filename: string; base64: string };
      let mime: string;
      if (fmt === 'xlsx') {
        res = await exportXlsx(workspaceSlug);
        mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      } else if (fmt === 'json') {
        res = await exportJson(workspaceSlug);
        mime = 'application/json';
      } else {
        res = await exportHtmlReport(workspaceSlug);
        mime = 'text/html';
      }
      triggerDownload(res.filename, res.base64, mime);
      toast.success(`Downloaded ${res.filename}`);
    } catch (e) {
      toast.error('Export failed', { description: String(e) });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" onClick={() => handle('xlsx')} disabled={busy !== null}>
        {busy === 'xlsx' ? <Loader2 className="size-4 animate-spin" /> : <Sheet className="size-4" />}
        Excel (.xlsx)
      </Button>
      <Button variant="outline" size="sm" onClick={() => handle('html')} disabled={busy !== null}>
        {busy === 'html' ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
        HTML (print → PDF)
      </Button>
      <Button variant="outline" size="sm" onClick={() => handle('json')} disabled={busy !== null}>
        {busy === 'json' ? <Loader2 className="size-4 animate-spin" /> : <Code2 className="size-4" />}
        JSON
      </Button>
    </div>
  );
}
