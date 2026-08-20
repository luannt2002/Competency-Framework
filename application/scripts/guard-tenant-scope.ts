/**
 * guard-tenant-scope.ts
 *
 * Chặn query quên điều kiện tenant trước khi nó chảy vào production.
 *
 * VẤN ĐỀ NÀY NGĂN GÌ
 * ------------------
 * 47 bảng trong DB là workspace-scoped (có cột `workspace_id`). Drizzle không
 * ép buộc gì: một `db.select().from(skills)` không có `eq(skills.workspaceId,
 * …)` vẫn chạy và trả **hàng của mọi tenant**. RLS chưa bật (0/47) nên không
 * có lớp bảo vệ nào bên dưới — nếu query thiếu điều kiện tenant, dữ liệu chảy
 * thẳng qua. Lỗi này đã từng thật: lookup workspace theo slug đơn lẻ cho phép
 * 2 chủ sở hữu cùng slug chiếm URL của nhau.
 *
 * GUARD LÀM GÌ
 * ------------
 * 1. Đọc `src/lib/db/schema*.ts`, tự suy ra danh sách bảng workspace-scoped
 *    (mọi pgTable có cột `workspaceId`). Danh sách không ghi tay — thêm bảng
 *    scoped mới thì guard tự động phủ luôn.
 * 2. Quét mọi file trong `src/` (trừ schema và guard). Với mỗi query Drizzle
 *    `.from(B)` / `.update(B)` / `.insert(B)` mà B là bảng scoped, lấy toàn bộ
 *    câu lệnh bao quanh (từ `;` trước tới `;` sau) và yêu cầu câu lệnh đó nhắc
 *    `workspaceId` (điều kiện where, cột insert, hoặc join) hoặc đi qua
 *    `withWorkspace`.
 *
 * CÁI GÌ TẠM THỜI ĐƯỢC
 * --------------------
 * Đây là heuristic theo câu lệnh, không phải AST: một câu lệnh chạm bảng scoped
 * mà **đề cập** `workspaceId` ở bất kỳ đâu là pass — kể cả chỗ không thật sự
 * lọc. Nghĩa là guard bắt sóng to (nhớ filter nhưng lọc nhầm cột thì không
 * bắt), đổi lại không cần parser và không có false positive ồn ào. Lớp phòng
 * thủ sau nó là RLS (mục 4.1 trong PLAN).
 *
 * CÁCH MIỄN TRỪ
 * -------------
 *  - Cả file: dòng đầu không trống là `// guard-tenant-scope: allow`
 *  - Một câu lệnh: comment `// guard-tenant-scope: allow` trên cùng dòng với
 *    `.from(`/`.update(`/`.insert(` — cho các câu join qua bảng đã scoped
 *    (ví dụ `lesson_skill_map` join bằng `lessonId` của bảng lessons đã lọc).
 *
 * Exit code: 0 sạch, 1 có vi phạm.
 */

import { readdir, readFile } from 'node:fs/promises';
import type { Dirent } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');
const SCHEMA_GLOB = 'schema';
const SCAN_EXTENSIONS = ['.ts', '.tsx'];
const FILE_ALLOW = 'guard-tenant-scope: allow';
const LINE_ALLOW = 'guard-tenant-scope: allow';

/** Bảng global (không scoped) không cần miễn trừ — guard tự bỏ qua. */
type Offence = { file: string; line: number; table: string; verb: string };

/** Suy ra bảng workspace-scoped: chunk `export const x = pgTable(` chứa cột workspaceId. */
function deriveScopedTables(schemaSources: Map<string, string>): Set<string> {
  const scoped = new Set<string>();
  for (const [file, source] of schemaSources) {
    // Each pgTable declaration lives in its own `export const … ;` chunk.
    const chunks = source.split(/(?=export const )/);
    for (const chunk of chunks) {
      const head = chunk.match(/^export const (\w+) = pgTable\(/);
      if (!head) continue;
      // Column region: from the pgTable( to its closing — stop at references()
      // lambdas by only looking before the first `.references(` or the config object.
      const body = chunk.slice(0, chunk.indexOf('.references(') === -1 ? chunk.length : chunk.indexOf('.references('));
      const tableName = head[1];
      if (tableName && /\bworkspaceId\s*:/.test(body)) scoped.add(tableName);
    }
    void file;
  }
  return scoped;
}

async function* walk(dir: string): AsyncGenerator<string> {
  let entries: Dirent[];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.next') continue;
      yield* walk(full);
    } else if (SCAN_EXTENSIONS.some((ext) => e.name.endsWith(ext))) {
      yield full;
    }
  }
}

/** Câu lệnh bao quanh vị trí `pos`: từ `;` trước đến `;` sau (giới hạn 4000 ký tự mỗi bên). */
function statementAround(source: string, pos: number): string {
  const start = Math.max(source.lastIndexOf(';', pos) + 1, pos - 4000);
  const nextSemi = source.indexOf(';', pos);
  const end = nextSemi === -1 ? Math.min(source.length, pos + 4000) : Math.min(nextSemi + 1, pos + 4000);
  return source.slice(start, end);
}

async function main() {
  // 1) Collect schema sources
  const schemaSources = new Map<string, string>();
  for await (const file of walk(join(SRC, 'lib', 'db'))) {
    const base = relative(ROOT, file);
    if (/schema[\w.-]*\.ts$/.test(base) || base.includes(SCHEMA_GLOB)) {
      schemaSources.set(base, await readFile(file, 'utf8'));
    }
  }
  const scoped = deriveScopedTables(schemaSources);

  if (scoped.size === 0) {
    console.error('guard-tenant-scope: không suy ra được bảng scoped nào từ schema — guard vô hiệu, xem lại nguồn.');
    process.exitCode = 1;
    return;
  }

  // 2) Scan the rest of src/
  const offences: Offence[] = [];
  const QUERY_RE = /\.(from|update|insert)\(\s*([A-Za-z_$][\w$]*)\s*[,)]/g;

  for await (const file of walk(SRC)) {
    const base = relative(ROOT, file);
    if (schemaSources.has(base)) continue; // schema files declare, they don't query
    const source = await readFile(file, 'utf8');
    if (source.split('\n').find((l) => l.trim())?.includes(FILE_ALLOW)) continue;

    for (const m of source.matchAll(QUERY_RE)) {
      const [, verb = '', table = ''] = m;
      if (!scoped.has(table)) continue;
      const lineNo = source.slice(0, m.index ?? 0).split('\n').length;
      const line = source.split('\n')[lineNo - 1];
      if (line?.includes(LINE_ALLOW)) continue;
      const stmt = statementAround(source, m.index ?? 0);
      if (/workspaceId|withWorkspace/.test(stmt)) continue; // tenant condition present
      offences.push({ file: base, line: lineNo, table, verb });
    }
  }

  if (offences.length === 0) {
    console.log(`guard-tenant-scope: sạch — mọi query chạm ${scoped.size} bảng workspace-scoped đều có điều kiện tenant.`);
    return;
  }

  const byFile = new Map<string, Offence[]>();
  for (const o of offences) {
    const list = byFile.get(o.file) ?? [];
    list.push(o);
    byFile.set(o.file, list);
  }

  console.error(
    `guard-tenant-scope: ${offences.length} câu query chạm bảng workspace-scoped mà không nhắc workspaceId/withWorkspace, trong ${byFile.size} file.\n`,
  );
  for (const [file, list] of [...byFile.entries()].sort((a, b) => b[1].length - a[1].length)) {
    console.error(`  ${file}  (${list.length})`);
    for (const o of list.slice(0, 8)) {
      console.error(`    ${o.line}: .${o.verb}(${o.table})  → thêm eq(${o.table}.workspaceId, …) hoặc miễn trừ nếu join qua bảng đã scoped`);
    }
    if (list.length > 8) console.error(`    … còn ${list.length - 8} chỗ nữa`);
  }
  console.error(
    '\nMiễn trừ: `// guard-tenant-scope: allow` trên cùng dòng query (join qua bảng đã scoped), hoặc ở dòng đầu cả file.',
  );
  process.exitCode = 1;
}

main().catch((err) => {
  console.error('guard-tenant-scope: lỗi khi chạy —', err);
  process.exitCode = 1;
});
