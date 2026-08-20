/**
 * seed-rbac-personas.ts — one account per RBAC tier, for cross-role testing.
 *
 * WHY
 * ---
 * The pentest report (`luannt-tets.md` §7) could not test IDOR / authz-bypass
 * across the 7-tier model at all: "cần 2 tài khoản khác role để test
 * authz-bypass chéo. Chưa có acc → chưa chạy." The flagship security feature
 * was therefore the one thing never exercised.
 *
 * Local dev authenticates through `DEV_AUTH_BYPASS_USER_ID` (see
 * `src/lib/auth/dev-bypass.ts`), which synthesises a user for whatever UUID
 * that env var holds. So "log in as an editor" just means pointing that var at
 * the editor's UUID. This script creates the DB side of that: one
 * `workspace_members` row per tier, on fixed UUIDs so the mapping is stable
 * across re-seeds.
 *
 * NOT a security bypass in production: `getDevBypassUser()` returns null when
 * NODE_ENV === 'production', and these rows are inert without it — they are
 * ordinary grants that a real signed-in user would also need.
 *
 * Idempotent: re-running updates the role in place instead of duplicating
 * (workspace_members has a unique index on (workspace_id, user_id)).
 *
 * Usage:
 *   npx tsx drizzle/scripts/seed-rbac-personas.ts [workspace-slug]
 * Default slug: devops-test
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' });

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq, and } from 'drizzle-orm';
import { workspaces, workspaceMembers } from '../../src/lib/db/schema';
import { RBAC_LEVELS, type RoleName } from '../../src/lib/rbac/levels';

/**
 * Fixed UUIDs — the last block encodes the numeric RBAC level, so a row in
 * `audit_log` or a failing test tells you which tier acted without a join.
 */
const PERSONAS: { id: string; role: RoleName; level: number; label: string }[] = [
  { id: '000000aa-0000-0000-0000-000000000010', role: 'viewer', level: RBAC_LEVELS.VIEWER, label: 'Chỉ xem' },
  { id: '000000aa-0000-0000-0000-000000000020', role: 'learner', level: RBAC_LEVELS.LEARNER, label: 'Người học' },
  { id: '000000aa-0000-0000-0000-000000000040', role: 'workspace_contributor', level: RBAC_LEVELS.CONTRIBUTOR, label: 'Cộng tác' },
  { id: '000000aa-0000-0000-0000-000000000060', role: 'workspace_editor', level: RBAC_LEVELS.EDITOR, label: 'Biên tập' },
];

const slug = process.argv[2] ?? 'devops-test';

const dbUrl = process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('[seed-rbac] DATABASE_URL missing. Copy .env.example → .env.local first.');
  process.exit(1);
}

const sql = postgres(dbUrl, { prepare: false, max: 1 });
const db = drizzle(sql);

async function main() {
  const [ws] = await db
    .select({ id: workspaces.id, slug: workspaces.slug, owner: workspaces.ownerUserId })
    .from(workspaces)
    .where(eq(workspaces.slug, slug))
    .limit(1);

  if (!ws) {
    console.error(`[seed-rbac] Không thấy workspace '${slug}'. Chạy \`pnpm db:setup\` trước.`);
    await sql.end();
    process.exit(1);
  }

  console.log(`[seed-rbac] workspace ${ws.slug} (${ws.id})`);
  console.log(`[seed-rbac] chủ sở hữu (ngầm định = workspace_owner, 80): ${ws.owner}\n`);

  for (const p of PERSONAS) {
    const existing = await db
      .select({ id: workspaceMembers.id, role: workspaceMembers.role })
      .from(workspaceMembers)
      .where(and(eq(workspaceMembers.workspaceId, ws.id), eq(workspaceMembers.userId, p.id)))
      .limit(1);

    if (existing[0]) {
      if (existing[0].role === p.role) {
        console.log(`  = ${p.role.padEnd(22)} ${p.id}  (đã có)`);
        continue;
      }
      await db
        .update(workspaceMembers)
        .set({ role: p.role })
        .where(eq(workspaceMembers.id, existing[0].id));
      console.log(`  ~ ${p.role.padEnd(22)} ${p.id}  (đổi từ ${existing[0].role})`);
      continue;
    }

    await db.insert(workspaceMembers).values({
      workspaceId: ws.id,
      userId: p.id,
      role: p.role,
      invitedBy: ws.owner,
      joinedAt: new Date(),
    });
    console.log(`  + ${p.role.padEnd(22)} ${p.id}  (tạo mới)`);
  }

  await sql.end();

  console.log(`\n[seed-rbac] Đăng nhập bằng từng vai: đổi DEV_AUTH_BYPASS_USER_ID trong .env.local`);
  console.log(`            rồi khởi động lại dev server.\n`);
  for (const p of PERSONAS) {
    console.log(`  ${String(p.level).padStart(3)}  ${p.label.padEnd(12)} DEV_AUTH_BYPASS_USER_ID=${p.id}`);
  }
  console.log(`   80  Chủ sở hữu   DEV_AUTH_BYPASS_USER_ID=${ws.owner}`);
  console.log(
    `\n  Lưu ý: UUID trong .env.local hiện tại được RBAC coi là super_admin (100)` +
      `\n  vì isDevBypassSuper() ưu tiên nó — dùng nó để test "quyền cao nhất",` +
      `\n  và bốn UUID trên để test bậc thấp hơn.`,
  );
}

main().catch((err) => {
  console.error('[seed-rbac] ERROR:', err);
  process.exit(1);
});
