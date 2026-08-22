/**
 * guard-hearts-single-source.ts
 *
 * Chặn việc đọc thẳng bảng `hearts` ở ngoài module tim.
 *
 * VẤN ĐỀ NÀY NGĂN GÌ
 * ------------------
 * Số tim trong bảng là số THÔ: chưa áp hồi phục theo giờ (1 tim / 4 giờ) và
 * chưa trừ hao vì nghỉ học. `readHearts()` áp cả hai rồi mới trả số. Bề mặt nào
 * đọc thẳng bảng sẽ hiện một con số khác với bề mặt gọi `readHearts` — cùng một
 * người, cùng một thời điểm, hai màn hình hai số.
 *
 * Lỗi này đã tái phát HAI lần:
 *  - Đợt rà F7 đo được ba mặt trả ba số khác nhau (topbar khoe 5/5 trong khi
 *    API trả 0), và `readHearts` ra đời kèm chú thích "Mọi bề mặt hiển thị tim
 *    phải gọi hàm này".
 *  - Sau đó trang chủ workspace `src/app/(app)/w/[slug]/page.tsx` vẫn còn đọc
 *    thẳng `heartsT`, nên thanh trên và thân trang lệch nhau.
 *
 * Chú thích không chặn được lần thứ ba. Guard thì có.
 *
 * GUARD LÀM GÌ
 * ------------
 * Quét `src/`, tìm mọi câu lệnh Drizzle chạm bảng `hearts` (`.from(hearts)`,
 * `.update(hearts)`, `.insert(hearts)`, kể cả khi import dưới bí danh như
 * `hearts as heartsT`). Cho phép ở:
 *   - `src/lib/gamification/hearts.ts`  — chính module tim
 *   - `src/actions/learn.ts`            — upsert nguyên tử khi trả lời sai
 *   - `src/actions/workspaces.ts`       — dòng khởi tạo 5/5 lúc tạo workspace
 * Mọi nơi khác phải đi qua `readHearts()`.
 *
 * CÁI GÌ TẠM THỜI ĐƯỢC
 * --------------------
 * Đây là heuristic theo chuỗi, không phải AST — cùng họ với guard-tenant-scope.
 * Nó bắt đúng dạng lỗi đã xảy ra hai lần (đọc bảng để HIỂN THỊ), không cố bắt
 * mọi cách lách có thể nghĩ ra.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC = join(process.cwd(), 'src');

/** Nơi được phép chạm thẳng bảng, kèm lý do — thêm vào đây phải có lý do. */
const ALLOWED = new Map<string, string>([
  ['lib/gamification/hearts.ts', 'chính module tim: readHearts / refill / decay / spend'],
  ['actions/learn.ts', 'upsert nguyên tử khi trả lời sai, tránh đua đọc-rồi-ghi'],
  ['actions/workspaces.ts', 'dòng khởi tạo 5/5 khi tạo hoặc fork workspace'],
]);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(full)) out.push(full);
  }
  return out;
}

const violations: { file: string; line: number; text: string }[] = [];

for (const file of walk(SRC)) {
  const rel = relative(SRC, file).split('\\').join('/');
  if (ALLOWED.has(rel)) continue;

  const src = readFileSync(file, 'utf8');

  // Bảng `hearts` hay được import dưới bí danh (`hearts as heartsT`). Lấy đúng
  // tên cục bộ đang dùng trong file này.
  const aliasMatch = src.match(/\bhearts\s+as\s+(\w+)/);
  const local = aliasMatch?.[1] ?? 'hearts';
  const pattern = new RegExp(`\\.(from|update|insert)\\(\\s*${local}\\s*[),]`);

  src.split('\n').forEach((line, i) => {
    if (pattern.test(line)) {
      violations.push({ file: rel, line: i + 1, text: line.trim() });
    }
  });
}

if (violations.length > 0) {
  console.error('guard-hearts-single-source: đọc thẳng bảng hearts ngoài module tim\n');
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}`);
    console.error(`    ${v.text}`);
  }
  console.error('\nDùng readHearts() từ @/lib/gamification/hearts — nó áp hồi phục theo');
  console.error('giờ và hao vì nghỉ học trước khi trả số. Đọc thẳng bảng cho ra số thô,');
  console.error('và màn hình này sẽ lệch với mọi màn hình khác.');
  console.error('\nNếu thật sự cần ghi thẳng (upsert nguyên tử, seed), thêm file vào');
  console.error('ALLOWED trong scripts/guard-hearts-single-source.ts KÈM LÝ DO.');
  process.exit(1);
}

console.log(
  `guard-hearts-single-source: sạch — mọi bề mặt hiển thị tim đều đi qua readHearts (${ALLOWED.size} nơi được phép ghi thẳng).`,
);
