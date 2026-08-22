/**
 * guard-action-authz.ts
 *
 * Chặn server action quên chốt quyền trước khi nó chảy vào production.
 *
 * VẤN ĐỀ NÀY NGĂN GÌ
 * ------------------
 * 23 file trong `src/actions/` đều mang `'use server'`, nên MỌI hàm `export
 * async function` trong đó là một endpoint gọi được thẳng từ trình duyệt, với
 * tham số do phía gọi tự đặt. 89 hàm như vậy. Không có lớp nào bên dưới chặn:
 * RLS chưa bật, và Drizzle không tự thêm điều kiện gì.
 *
 * Nghĩa là một hàm quên gọi `resolveWorkspace` sẽ nhận `workspaceId` /`userId`
 * do kẻ gọi truyền vào và thao tác đúng theo lời họ. Đây không phải giả định:
 * `isFollowingWorkspace(workspaceId, userId)` nhận cả hai id từ tham số và đọc
 * thẳng bảng, nên bất kỳ ai đăng nhập cũng tra được người khác có theo dõi
 * workspace nào.
 *
 * GUARD LÀM GÌ
 * ------------
 * 1. Lấy mọi file `src/actions/*.ts` có `'use server'`.
 * 2. Lấy mọi `export async function`.
 * 3. Thân hàm phải nhắc tới một trong các chốt: `resolveWorkspace`,
 *    `resolveOwnerWorkspace`, `requireUser`, `requireMinLevel`.
 * 4. Nếu không có, LẦN THEO UỶ QUYỀN MỘT CẤP: nếu thân hàm gọi một hàm khác
 *    định nghĩa trong cùng file, và hàm đó có chốt, thì tính là đạt. (Có thật:
 *    `exportXlsx` uỷ quyền cho `buildRows`, nơi mới gọi `resolveWorkspace`.)
 * 5. Còn lại phải nằm trong ALLOWED kèm lý do viết tay.
 *
 * CÁI GÌ TẠM THỜI ĐƯỢC
 * --------------------
 * Heuristic theo chuỗi, không phải AST — cùng họ với guard-tenant-scope. Nó
 * kiểm SỰ CÓ MẶT của chốt, không kiểm chốt đó có đúng mức quyền hay không. Một
 * hàm admin gọi `resolveWorkspace(slug, LEARNER)` vẫn lọt. Guard này bắt loại
 * lỗi "quên hẳn", là loại đã xảy ra; mức quyền đúng hay sai vẫn cần người đọc.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ACTIONS = join(process.cwd(), 'src', 'actions');

const AUTHZ = /resolveWorkspace|resolveOwnerWorkspace|requireUser|requireMinLevel/;

/**
 * Hàm được miễn, kèm lý do. Thêm vào đây phải viết được lý do.
 *
 * Hiện đang rỗng, và nên giữ như thế. `isFollowingWorkspace` từng nằm ở đây vì
 * nó nhận `userId` qua tham số; đã sửa để lấy từ phiên đăng nhập thay vì ghi
 * miễn trừ — một dòng miễn trừ là một lỗ hổng được cấp phép ở lại.
 */
const ALLOWED = new Map<string, string>([]);

type Violation = { file: string; fn: string };
const violations: Violation[] = [];
let checked = 0;

for (const name of readdirSync(ACTIONS)) {
  if (!name.endsWith('.ts')) continue;
  const src = readFileSync(join(ACTIONS, name), 'utf8');
  if (!/['"]use server['"]/.test(src)) continue;

  // Cắt file thành từng khối hàm top-level: từ `function tên(` tới dòng `}` ở
  // cột 0 kế tiếp. Đủ dùng vì mọi hàm ở đây đều là top-level.
  const blocks = new Map<string, string>();
  const lines = src.split('\n');
  let current: string | null = null;
  let buf: string[] = [];
  for (const line of lines) {
    const m = line.match(/^(?:export\s+)?async function (\w+)/);
    if (m) {
      if (current) blocks.set(current, buf.join('\n'));
      current = m[1]!;
      buf = [line];
      continue;
    }
    if (current) {
      buf.push(line);
      if (line === '}') {
        blocks.set(current, buf.join('\n'));
        current = null;
        buf = [];
      }
    }
  }
  if (current) blocks.set(current, buf.join('\n'));

  const exported = [...src.matchAll(/^export async function (\w+)/gm)].map((m) => m[1]!);

  for (const fn of exported) {
    checked++;
    const key = `${name}:${fn}`;
    if (ALLOWED.has(key)) continue;

    const body = blocks.get(fn) ?? '';
    if (AUTHZ.test(body)) continue;

    // Uỷ quyền một cấp: hàm nào trong cùng file được gọi từ thân hàm này?
    const delegatesOk = [...blocks.keys()].some(
      (helper) =>
        helper !== fn &&
        new RegExp(`\\b${helper}\\s*\\(`).test(body) &&
        AUTHZ.test(blocks.get(helper) ?? ''),
    );
    if (delegatesOk) continue;

    violations.push({ file: name, fn });
  }
}

if (violations.length > 0) {
  console.error('guard-action-authz: server action không thấy chốt quyền nào\n');
  for (const v of violations) {
    console.error(`  src/actions/${v.file}  →  ${v.fn}()`);
  }
  console.error('\nMỗi file trong src/actions mang \'use server\', nên hàm export ở đó là');
  console.error('endpoint gọi được từ trình duyệt với tham số do phía gọi tự đặt.');
  console.error('Gọi resolveWorkspace(slug, RBAC_LEVELS.X) — nó vừa xác thực người dùng');
  console.error('vừa giải workspace, và trả cùng một lỗi cho "không có" lẫn "không được',);
  console.error('phép" nên người ngoài không dò được slug.');
  console.error('\nNếu hàm thật sự không cần chốt, thêm vào ALLOWED trong');
  console.error('scripts/guard-action-authz.ts KÈM LÝ DO.');
  process.exit(1);
}

console.log(
  `guard-action-authz: sạch — ${checked} server action đều có chốt quyền ` +
    `(${ALLOWED.size} miễn trừ có ghi lý do).`,
);
