/**
 * /w/[slug]/audit — Workspace audit log viewer (OWNER-only).
 *
 * Server Component. Fetches the latest 100 audit rows for this workspace and
 * renders a clean table. Each row exposes a "View" toggle that expands an
 * inline before/after JSON diff via the `AuditRow` client component.
 *
 * Non-owners are redirected to /w/[slug]. See `src/lib/rbac/server.ts`.
 */

import { desc, eq, count } from 'drizzle-orm';
import { ShieldCheck, ListChecks } from 'lucide-react';
import { db } from '@/lib/db/client';
import { auditLog } from '@/lib/db/schema';

import { RBAC_LEVELS } from '@/lib/rbac/levels';

import { StatChip } from '@/components/learn/stat-chip';
import { EmptyState } from '@/components/ui/empty-state';
import { AuditRow, type AuditRowData } from '@/components/admin/audit-row';
import { requireAdminPage } from '@/lib/workspace';

export default async function AuditPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Một cửa duy nhất cho trang quản trị — xem lib/workspace.ts.
  const ws = await requireAdminPage(slug, RBAC_LEVELS.OWNER);

  const [rows, totalRows] = await Promise.all([
    db
      .select()
      .from(auditLog)
      .where(eq(auditLog.workspaceId, ws.id))
      .orderBy(desc(auditLog.createdAt))
      .limit(100),
    db.select({ n: count() }).from(auditLog).where(eq(auditLog.workspaceId, ws.id)),
  ]);

  const total = totalRows[0]?.n ?? 0;

  // Serialize Date → string so the client component sees plain JSON.
  const data: AuditRowData[] = rows.map((r) => ({
    id: r.id,
    createdAt: (r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt ?? '')),
    actorUserId: r.actorUserId,
    actorRole: r.actorRole,
    action: r.action,
    resourceType: r.resourceType,
    resourceId: r.resourceId,
    before: r.before,
    after: r.after,
  }));

  return (
    <div
      className="mx-auto max-w-6xl p-6 md:p-10 space-y-8"
      style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
    >
      <header className="flex items-center gap-4">
        <div className="size-12 rounded-2xl accent-gradient flex items-center justify-center shadow-lg shadow-hue-1/20">
          <ShieldCheck className="size-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Audit log</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {ws.name} · latest 100 sensitive mutations, newest first.
          </p>
        </div>
      </header>

      <section className="grid gap-3 grid-cols-2 md:grid-cols-3 max-w-2xl">
        <StatChip
          icon={ListChecks}
          label="Showing"
          value={String(data.length)}
          sub="rows"
          color="text-hue-1"
        />
        <StatChip
          icon={ShieldCheck}
          label="Total"
          value={String(total)}
          sub="all-time"
          color="text-amber-500"
        />
      </section>

      {data.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="No audit entries yet"
          description="As soon as an editor or owner makes a sensitive change, it will land here."
        />
      ) : (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40 text-muted-foreground">
                <tr className="text-left">
                  <th className="px-4 py-3 font-medium">Time</th>
                  <th className="px-4 py-3 font-medium">Actor</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                  <th className="px-4 py-3 font-medium">Resource type</th>
                  <th className="px-4 py-3 font-medium">Resource ID</th>
                  <th className="px-4 py-3 font-medium text-right">Diff</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row) => (
                  <AuditRow key={row.id} row={row} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
