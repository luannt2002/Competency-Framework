/**
 * verify-rbac-tiers.ts — chạy thật bộ resolver RBAC cho từng vai.
 *
 * Trả lời câu mà `luannt-tets.md` §7 bỏ ngỏ: 7 tier có thật sự phân tầng
 * đúng không, và một vai ở workspace này có leo được sang workspace khác không.
 *
 * Không mock. Gọi thẳng `getEffectiveLevel()` trong `src/lib/rbac/server.ts` —
 * đúng hàm mà mọi server action dùng — nên kết quả ở đây là kết quả thật.
 *
 * Chạy: npx tsx drizzle/scripts/verify-rbac-tiers.ts
 * Cần: `npx tsx drizzle/scripts/seed-rbac-personas.ts` trước đó.
 *
 * Exit 1 nếu có bất kỳ kỳ vọng nào sai — dùng được trong CI.
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' });

// getEffectiveLevel đọc DEV_AUTH_BYPASS_USER_ID để cấp super_admin. Ở đây ta
// kiểm tra tầng quyền theo GRANT trong DB, nên phải gỡ nó ra trước khi import,
// nếu không mọi user đều trả về 100 và phép thử thành vô nghĩa.
const bypassBackup = process.env.DEV_AUTH_BYPASS_USER_ID;
delete process.env.DEV_AUTH_BYPASS_USER_ID;

// UUID mã hoá luôn bậc mong đợi ở block cuối, nên bảng này không cần
// RBAC_LEVELS ở tầm module — quan trọng, vì mọi import phải nằm TRONG main().
const PERSONA_IDS = {
  viewer: '000000aa-0000-0000-0000-000000000010',
  learner: '000000aa-0000-0000-0000-000000000020',
  contributor: '000000aa-0000-0000-0000-000000000040',
  editor: '000000aa-0000-0000-0000-000000000060',
} as const;

/** Người lạ hoàn toàn — không grant nào. */
const OUTSIDER = '000000bb-0000-0000-0000-0000000000ff';

let failures = 0;

function check(name: string, actual: number, expected: number, note = '') {
  const ok = actual === expected;
  if (!ok) failures++;
  console.log(
    `  ${ok ? 'ok  ' : 'FAIL'}  ${name.padEnd(42)} ${String(actual).padStart(3)} (mong ${expected})${note ? '  ' + note : ''}`,
  );
}

async function main() {
  // Import ĐỘNG và nằm TRONG hàm, vì hai lý do:
  //  1. tsx biên dịch sang CJS → `import` tĩnh bị kéo lên trên `loadEnv()`,
  //     khiến `db/client.ts` chạy khi DATABASE_URL chưa có và ném lúc nạp module.
  //  2. top-level await không được CJS hỗ trợ, nên không thể để ở tầm module.
  // Nhờ vậy việc gỡ DEV_AUTH_BYPASS_USER_ID ở trên cũng kịp có hiệu lực trước
  // khi `rbac/server.ts` đọc nó.
  const { db } = await import('../../src/lib/db/client');
  const { workspaces } = await import('../../src/lib/db/schema');
  const { getEffectiveLevel } = await import('../../src/lib/rbac/server');
  const { RBAC_LEVELS } = await import('../../src/lib/rbac/levels');

  const PERSONAS = [
    { id: PERSONA_IDS.viewer, label: 'viewer', expect: RBAC_LEVELS.VIEWER },
    { id: PERSONA_IDS.learner, label: 'learner', expect: RBAC_LEVELS.LEARNER },
    { id: PERSONA_IDS.contributor, label: 'contributor', expect: RBAC_LEVELS.CONTRIBUTOR },
    { id: PERSONA_IDS.editor, label: 'editor', expect: RBAC_LEVELS.EDITOR },
  ];

  const rows = await db
    .select({ id: workspaces.id, slug: workspaces.slug, owner: workspaces.ownerUserId })
    .from(workspaces)
    .orderBy(workspaces.slug);

  const target = rows.find((r) => r.slug === 'devops-test');
  const other = rows.find((r) => r.slug !== 'devops-test');
  if (!target) throw new Error("Không thấy workspace 'devops-test'");

  console.log(`\nWorkspace đích : ${target.slug} (${target.id})`);
  if (other) console.log(`Workspace khác : ${other.slug} (${other.id})`);

  console.log('\n── Bậc quyền trong workspace đích ──');
  for (const p of PERSONAS) {
    const r = await getEffectiveLevel(target.id, p.id);
    check(p.label, r.level, p.expect);
  }
  if (target.owner) {
    const r = await getEffectiveLevel(target.id, target.owner);
    check('owner (ngầm định, không có row member)', r.level, RBAC_LEVELS.OWNER);
  }

  console.log('\n── Không đăng nhập / người lạ ──');
  const guest = await getEffectiveLevel(target.id, null);
  check('chưa đăng nhập → guest', guest.level, RBAC_LEVELS.GUEST);
  const stranger = await getEffectiveLevel(target.id, OUTSIDER);
  check('đã đăng nhập nhưng không là thành viên', stranger.level, RBAC_LEVELS.VIEWER);

  if (other) {
    console.log('\n── Leo quyền chéo workspace (điểm mấu chốt) ──');
    for (const p of PERSONAS) {
      const r = await getEffectiveLevel(other.id, p.id);
      // Grant chỉ có ở workspace đích. Sang workspace khác họ phải rơi về
      // viewer (đã đăng nhập, không phải thành viên) — KHÔNG mang theo bậc cũ.
      check(`${p.label} sang '${other.slug}'`, r.level, RBAC_LEVELS.VIEWER, 'không mang bậc theo');
    }
  }

  console.log(
    `\n${failures === 0 ? '✓ Tất cả đúng' : `✗ ${failures} kỳ vọng SAI`} — ` +
      `DEV_AUTH_BYPASS_USER_ID đã được gỡ khi đo (giá trị thật: ${bypassBackup ?? 'không đặt'}).\n`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('[verify-rbac] ERROR:', err);
  process.exit(1);
});
