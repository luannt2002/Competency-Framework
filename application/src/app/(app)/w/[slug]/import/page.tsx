/**
 * /w/[slug]/import — Framework import wizard (OWNER-only).
 * Paste a PHASE markdown file → phase + weeks tree nodes.
 */
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { FileUp } from 'lucide-react';
import { db } from '@/lib/db/client';
import { workspaces } from '@/lib/db/schema';
import { requireUser } from '@/lib/auth/supabase-server';
import { RBAC_LEVELS } from '@/lib/rbac/levels';
import { requireMinLevel, RBACError } from '@/lib/rbac/server';
import { ImportWizard } from '@/components/admin/import-wizard';

export default async function ImportPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  await requireUser();
  const rows = await db
    .select({ id: workspaces.id, slug: workspaces.slug })
    .from(workspaces)
    .where(eq(workspaces.slug, slug))
    .limit(1);
  const ws = rows[0];
  if (!ws) redirect('/');
  try {
    await requireMinLevel(ws.id, RBAC_LEVELS.OWNER);
  } catch (err) {
    if (err instanceof RBACError) redirect(`/w/${ws.slug}`);
    throw err;
  }

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
