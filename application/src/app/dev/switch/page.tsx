/**
 * Dev-only user switcher — /dev/switch.
 *
 * Renders 404 when NODE_ENV === 'production' (the page code never runs, and
 * the cookie it sets is never read in prod — see src/lib/auth/dev-bypass.ts).
 *
 * Lists every user id that appears in workspace_members plus every workspace
 * owner, with their effective role (level + canonical role name via
 * getEffectiveLevel) per workspace. "Dùng user này" sets the dev_bypass_user
 * cookie so getCurrentUser() synthesizes that user without a dev-server
 * restart.
 */
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/client';
import { workspaces, workspaceMembers } from '@/lib/db/schema';
import { getEffectiveLevel, type EffectiveRole } from '@/lib/rbac/server';
import { DEV_BYPASS_USER_COOKIE } from '@/lib/auth/dev-bypass';
import { RBAC_LEVELS } from '@/lib/rbac/levels';

export const dynamic = 'force-dynamic';

/** Persona labels from drizzle/scripts/seed-rbac-personas.ts (last block = level). */
const PERSONA_LABELS: Record<string, string> = {
  '000000aa-0000-0000-0000-000000000010': 'viewer (10)',
  '000000aa-0000-0000-0000-000000000020': 'learner (20)',
  '000000aa-0000-0000-0000-000000000040': 'workspace_contributor (40)',
  '000000aa-0000-0000-0000-000000000060': 'workspace_editor (60)',
};

async function switchUser(userId: string) {
  'use server';
  if (process.env.NODE_ENV === 'production') notFound();
  const cookieStore = await cookies();
  cookieStore.set(DEV_BYPASS_USER_COOKIE, userId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    // Session cookie — enough for dev testing, no stale persona later.
  });
}

async function resetUser() {
  'use server';
  if (process.env.NODE_ENV === 'production') notFound();
  const cookieStore = await cookies();
  cookieStore.delete(DEV_BYPASS_USER_COOKIE);
}

export default async function DevSwitchPage() {
  if (process.env.NODE_ENV === 'production') notFound();

  if (!process.env.DEV_AUTH_BYPASS_USER_ID) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <h1 className="text-lg font-semibold">Dev user switcher</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          DEV_AUTH_BYPASS_USER_ID chưa được set trong .env.local — bypass đang
          tắt, cookie sẽ không có tác dụng.
        </p>
      </main>
    );
  }

  const cookieStore = await cookies();
  const currentId =
    cookieStore.get(DEV_BYPASS_USER_COOKIE)?.value ?? process.env.DEV_AUTH_BYPASS_USER_ID;

  const wsRows = await db
    .select({ id: workspaces.id, slug: workspaces.slug, name: workspaces.name })
    .from(workspaces);
  const memberRows = await db
    .selectDistinct({ userId: workspaceMembers.userId })
    .from(workspaceMembers); // guard-tenant-scope: allow — trang dev-only, liệt kê mọi user để đổi vai

  const ownerRows = await db
    .select({ ownerUserId: workspaces.ownerUserId })
    .from(workspaces);

  // Distinct candidate ids: all members + all workspace owners
  const userIds = [
    ...new Set([
      ...memberRows.map((m) => m.userId),
      ...ownerRows.map((o) => o.ownerUserId).filter((id): id is string => id !== null),
    ]),
  ];

  // Effective role per (user, workspace)
  const roles = new Map<string, Map<string, EffectiveRole>>();
  for (const uid of userIds) {
    const perWs = new Map<string, EffectiveRole>();
    for (const w of wsRows) {
      perWs.set(w.slug, await getEffectiveLevel(w.id, uid));
    }
    roles.set(uid, perWs);
  }

  return (
    <main className="mx-auto max-w-3xl p-8 space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Dev user switcher</h1>
        <p className="text-sm text-muted-foreground">
          Đang dùng: <code className="text-xs">{currentId}</code>
        </p>
        <form action={resetUser} className="mt-2">
          <button
            type="submit"
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary"
          >
            Reset về env (DEV_AUTH_BYPASS_USER_ID)
          </button>
        </form>
      </div>

      <ul className="space-y-3">
        {userIds.map((uid) => {
          const active = uid === currentId;
          return (
            <li
              key={uid}
              className={`rounded-xl border p-4 ${active ? 'border-primary bg-primary/5' : 'border-border'}`}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-mono text-xs break-all">{uid}</div>
                  <div className="text-xs text-muted-foreground">
                    {PERSONA_LABELS[uid] ?? 'workspace owner / seeded user'}
                  </div>
                </div>
                <form action={switchUser.bind(null, uid)}>
                  <button
                    type="submit"
                    disabled={active}
                    className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    {active ? 'Đang dùng' : 'Dùng user này'}
                  </button>
                </form>
              </div>
              <dl className="mt-3 grid gap-1 text-xs">
                {wsRows.map((w) => {
                  const r = roles.get(uid)?.get(w.slug);
                  if (!r) return null;
                  return (
                    <div key={w.slug} className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">{w.name} ({w.slug})</dt>
                      <dd>
                        {r.role} · {r.level}
                        {r.level >= RBAC_LEVELS.OWNER ? ' ✓ admin nav' : ''}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
