/**
 * Chạy các file SQL trong `drizzle/migrations/` theo thứ tự, đúng một lần mỗi file.
 *
 * VÌ SAO CẦN, THAY VÌ `drizzle-kit push`
 * --------------------------------------
 * `push` so lược đồ TS với DB rồi ép DB khớp TS. Nhưng một phần lược đồ ở đây
 * KHÔNG diễn đạt được bằng TS — các ràng buộc CHECK do migration SQL thô tạo:
 *
 *     exercises_kind_slug_check      (định dạng slug dạng bài)
 *     exercise_types_slug_check
 *     uea_status_check, uea_score_range_check
 *     notifications_kind_check
 *
 * Drizzle không thấy chúng trong TS nên luôn coi là thừa và sinh lệnh
 * `DROP CONSTRAINT`. Chạy `push` một lần là mất sạch các ràng buộc toàn vẹn,
 * âm thầm, và DB bắt đầu nhận dữ liệu mà trước đó nó từ chối.
 *
 * Sự cố 22/08/2026 còn nặng hơn thế: lúc đó `drizzle.config.ts` mới chỉ khai
 * `schema.ts` trong khi lược đồ nằm ở 14 file, nên `push --force` xoá luôn 3
 * bảng và cột `badges.is_active`. Cấu hình đã vá, nhưng phần CHECK thì không
 * vá bằng cấu hình được — chỉ có cách đừng dùng `push`.
 *
 * DÙNG NHƯ THẾ NÀO
 *     pnpm db:migrate             áp các migration chưa chạy
 *     pnpm db:migrate --dry       chỉ liệt kê, không chạy
 *     pnpm db:migrate --baseline  ghi nhận TẤT CẢ là đã áp, KHÔNG chạy gì
 *
 * `--baseline` dùng đúng một lần, cho một DB vốn được dựng bằng `push` nên sổ
 * ghi còn rỗng dù mọi thay đổi đã có mặt. Chạy lại từ đầu ở đó sẽ hỏng vì bảng
 * đã tồn tại. Trên một DB trống thì KHÔNG dùng cờ này — dùng là bỏ qua sạch.
 *
 * Mỗi file chạy trong MỘT transaction: hỏng giữa chừng thì không để lại
 * migration nửa vời.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { config as loadEnv } from 'dotenv';
import postgres from 'postgres';

loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' });

const MIGRATIONS_DIR = join(process.cwd(), 'drizzle', 'migrations');
const DRY = process.argv.includes('--dry');
const BASELINE = process.argv.includes('--baseline');

async function main() {
  const url = process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL;
  if (!url) throw new Error('Thiếu DATABASE_URL_DIRECT / DATABASE_URL');

  const sql = postgres(url, { max: 1 });

  try {
    // Sổ ghi migration đã chạy. Tên bảng khác `__drizzle_migrations` của
    // drizzle-kit để hai cơ chế không giẫm chân nhau.
    await sql`
      CREATE TABLE IF NOT EXISTS applied_sql_migrations (
        filename   text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )`;

    const applied = new Set(
      (await sql<{ filename: string }[]>`SELECT filename FROM applied_sql_migrations`).map(
        (r) => r.filename,
      ),
    );

    const files = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    const pending = files.filter((f) => !applied.has(f));

    if (pending.length === 0) {
      console.log(`[migrate] Không có migration nào chờ (${files.length} file đã áp).`);
      return;
    }

    console.log(`[migrate] ${pending.length}/${files.length} migration chờ áp:`);
    for (const f of pending) console.log(`  - ${f}`);

    if (DRY) {
      console.log('[migrate] --dry: không chạy gì.');
      return;
    }

    if (BASELINE) {
      for (const filename of pending) {
        await sql`INSERT INTO applied_sql_migrations (filename) VALUES (${filename})
                  ON CONFLICT DO NOTHING`;
      }
      console.log(
        `[migrate] --baseline: ghi nhận ${pending.length} migration là ĐÃ ÁP, không chạy file nào.`,
      );
      return;
    }

    for (const filename of pending) {
      const body = readFileSync(join(MIGRATIONS_DIR, filename), 'utf8');
      process.stdout.write(`[migrate] ${filename} ... `);
      // `sql.begin` bọc cả file trong một transaction.
      await sql.begin(async (tx) => {
        await tx.unsafe(body);
        await tx`INSERT INTO applied_sql_migrations (filename) VALUES (${filename})`;
      });
      console.log('xong');
    }

    console.log(`[migrate] Đã áp ${pending.length} migration.`);
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error('[migrate] HỎNG:', err instanceof Error ? err.message : err);
  process.exit(1);
});
