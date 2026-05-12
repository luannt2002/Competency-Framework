/**
 * /w/[slug]/members — Workspace member management (OWNER-only).
 *
 * Server Component. Fetches workspace_members rows for the current workspace
 * and renders a table with role-change + remove controls. Non-owners are
 * redirected to /w/[slug] via the RBAC guard.
 *
 * The workspace owner is NOT listed here — the owner is implied by
 * workspaces.owner_user_id and never stored in workspace_members. See
 * `docs/dev/RBAC_PERMISSIONS.md`.
 */
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { desc, eq } from 'drizzle-orm';
import { Users, Award } from 'lucide-react';
import { db } from '@/lib/db/client';
import { workspaces, workspaceMembers } from '@/lib/db/schema';
import { requireUser } from '@/lib/auth/supabase-server';
import { RBAC_LEVELS } from '@/lib/rbac/levels';
import { requireMinLevel, RBACError } from '@/lib/rbac/server';
import { StatChip } from '@/components/learn/stat-chip';
import { EmptyState } from '@/components/ui/empty-state';
import { InviteMemberDialog } from '@/components/admin/invite-member-dialog';
import { MemberRowActions } from '@/components/admin/member-row-actions';
import { BulkInviteCsv } from '@/components/admin/bulk-invite-csv';

/** Render a UUID as `aaaa…zzzz` (first/last 4 chars). */
function shortId(id: string): string {
  if (id.length <= 10) return id;
  return `${id.slice(0, 4)}…${id.slice(-4)}`;
}

function formatDate(d: Date | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleString();
}

function roleLabel(role: string): string {
  switch (role) {
    case 'workspace_editor':
      return 'Editor';
    case 'workspace_contributor':
      return 'Contributor';
    case 'learner':
      return 'Learner';
    case 'viewer':
      return 'Viewer';
    default:
      return role;
  }
}

export default async function MembersPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await requireUser();

  // Resolve workspace by slug (no owner check — RBAC guard below handles it).
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

  // OWNER-only — non-owners get redirected (not 404).
  try {
    await requireMinLevel(ws.id, RBAC_LEVELS.OWNER);
  } catch (err) {
    if (err instanceof RBACError) redirect(`/w/${ws.slug}`);
    throw err;
  }

  const members = await db
    .select()
    .from(workspaceMembers)
    .where(eq(workspaceMembers.workspaceId, ws.id))
    .orderBy(desc(workspaceMembers.invitedAt));

  return (
    <div
      className="mx-auto max-w-5xl p-6 md:p-10 space-y-8"
      style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
    >
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="size-12 rounded-2xl accent-gradient flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Users className="size-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Members</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {ws.name} · manage who can access this workspace.
            </p>
          </div>
        </div>
        <InviteMemberDialog workspaceSlug={ws.slug} />
      </header>

      <section className="grid gap-3 grid-cols-2 md:grid-cols-3 max-w-2xl">
        <StatChip
          icon={Users}
          label="Members"
          value={String(members.length)}
          sub="non-owner"
          color="text-cyan-500"
        />
        <StatChip
          icon={Users}
          label="Owner"
          value={shortId(ws.ownerUserId ?? '—')}
          sub={ws.ownerUserId === user.id ? 'you' : 'workspace owner'}
          color="text-amber-500"
        />
      </section>

      {members.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No members yet"
          description="Invite a teammate to give them access to this workspace. The owner row isn't listed here — owners are implied via workspaces.owner_user_id."
        />
      ) : (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-muted-foreground">
              <tr className="text-left">
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Invited at</th>
                <th className="px-4 py-3 font-medium">Joined at</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-t border-border hover:bg-secondary/20">
                  <td className="px-4 py-3 font-mono text-xs" style={{ fontFamily: 'var(--font-jetbrains), monospace' }}>
                    {shortId(m.userId)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-md bg-secondary/60 px-2 py-0.5 text-xs font-medium text-foreground/80">
                      {roleLabel(m.role)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(m.invitedAt)}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(m.joinedAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <Link
                        href={`/w/${ws.slug}/certificate/${m.id}`}
                        target="_blank"
                        rel="noopener"
                        aria-label="View certificate"
                        title="Open certificate (PDF)"
                        className="inline-flex items-center justify-center size-8 rounded-md text-amber-500 hover:bg-amber-500/10 transition-colors"
                      >
                        <Award className="size-4" />
                      </Link>
                      <MemberRowActions
                        workspaceSlug={ws.slug}
                        memberId={m.id}
                        currentRole={m.role}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <BulkInviteCsv workspaceSlug={ws.slug} />
    </div>
  );
}
