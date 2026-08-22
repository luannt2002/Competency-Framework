/**
 * /w/[slug]/import — Framework import wizard (OWNER-only).
 * Paste a PHASE markdown file → phase + weeks tree nodes.
 */

import { FileUp } from 'lucide-react';

import { RBAC_LEVELS } from '@/lib/rbac/levels';

import { ImportWizard } from '@/components/admin/import-wizard';
import { requireAdminPage } from '@/lib/workspace';

export default async function ImportPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  // Một cửa duy nhất cho trang quản trị — xem lib/workspace.ts.
  const ws = await requireAdminPage(slug, RBAC_LEVELS.OWNER);

  return (
    <div className="mx-auto max-w-3xl p-6 md:p-10 space-y-6">
      <header className="flex items-center gap-4">
        <div className="size-12 rounded-2xl accent-gradient flex items-center justify-center shadow-lg shadow-primary/20">
          <FileUp className="size-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Import framework</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Biến file markdown lộ trình thành cây học tập — chỉ owner mới dùng được.
          </p>
        </div>
      </header>
      <ImportWizard workspaceSlug={ws.slug} />
    </div>
  );
}
