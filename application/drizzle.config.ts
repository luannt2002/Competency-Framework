import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

// Load .env.local first (dev), fallback to .env (CI/prod)
loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' });

export default defineConfig({
  /**
   * TẤT CẢ file schema, không chỉ `schema.ts`.
   *
   * Trước đợt này ở đây chỉ khai `./src/lib/db/schema.ts`, trong khi lược đồ
   * nằm rải ở 14 file (`schema-badges.ts`, `schema-v9.ts`, `schema-tree.ts`,
   * …). drizzle-kit vì thế chỉ nhìn thấy một phần và coi phần còn lại là
   * THỪA — `db:push` sinh ra lệnh xoá chúng đi.
   *
   * Đã xảy ra thật, 22/08/2026: một lần `pnpm db:push --force` để thêm index
   * đã chạy kèm
   *     ALTER TABLE "badges" DROP COLUMN "is_active"
   *     DROP TYPE "public"."exercise_kind"
   * và xoá 3 bảng `certificates`, `exercise_types`, `workspace_invites`.
   * Cấu trúc dựng lại được từ migration, nhưng DỮ LIỆU trong ba bảng đó thì
   * mất hẳn — kể cả dòng `exercise_types` mà e2e phụ thuộc.
   *
   * `db:setup` cũng gọi `drizzle-kit push`, nên bẫy này nằm trên cả đường
   * dựng môi trường mới.
   *
   * Dùng glob thay vì liệt kê tay: thêm file schema mới thì không phải nhớ
   * cập nhật chỗ này — mà quên cập nhật chính là cách sự cố trên xảy ra.
   */
  schema: './src/lib/db/schema*.ts',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
