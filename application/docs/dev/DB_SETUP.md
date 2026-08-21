# Dựng DB từ số 0 — một đường duy nhất

> Chốt đợt B (`PLAN_FIX_ALL.md`), 2026-08-21. Mọi lệnh dưới đây đã chạy thật.

## Nguồn sự thật: **chuỗi migration**

`drizzle/migrations/*.sql` + `meta/_journal.json` là nơi duy nhất định nghĩa
schema. `drizzle-kit push` **không còn** là đường dựng chính — nó diff thẳng từ
`schema.ts` và không diễn tả được RLS / policy / CHECK / thứ tự index, là đúng
những thứ dự án cần.

## Dựng mới (môi trường trắng)

```bash
export PATH=~/.local/node20/bin:$PATH          # Node 20, KHÔNG dùng node hệ thống 18
docker exec competency-postgres psql -U postgres -c "CREATE DATABASE <db> OWNER competency_app;"
DATABASE_URL="postgresql://competency_app:competency_app_dev@localhost:5434/<db>" \
DATABASE_URL_DIRECT="$DATABASE_URL" \
  pnpm exec drizzle-kit migrate
DATABASE_URL=... pnpm db:seed
```

Đã kiểm chứng 2026-08-21: DB trắng → `migrate` (16 migration) → `db:seed` →
**50 bảng**, `drizzle.__drizzle_migrations` ghi đủ **16** dòng.

## Kiểm schema có trôi không

```bash
docker exec competency-postgres pg_dump -U postgres -d competency       --schema-only --no-owner --no-acl --schema=public > /tmp/real.sql
docker exec competency-postgres pg_dump -U postgres -d competency_verify --schema-only --no-owner --no-acl --schema=public > /tmp/ver.sql
norm() { grep -v '^--' "$1" | grep -v '^SET ' | grep -v '^SELECT pg_catalog' | grep -v 'restrict' | sed '/^$/d' | sort; }
diff <(norm /tmp/real.sql) <(norm /tmp/ver.sql)
```

Bỏ `\restrict`/`\unrestrict`: đó là nonce ngẫu nhiên pg_dump sinh mỗi lần, không phải schema.

## Đã sửa gì ở đợt B

| Lỗi tìm ra (đo thật) | Vá |
|---|---|
| `_journal.json` chỉ có **2 entry / 14 file .sql** → `migrate` bỏ qua 12 file | dựng lại journal đủ **16 entry** |
| `drizzle.__drizzle_migrations` **không tồn tại** trong DB dev → `migrate` chưa từng chạy lần nào | DB mới có đủ 16 dòng |
| `node_type_appearance` có trong DB dev nhưng **không migration nào tạo** (do `push`) | `0017_node_type_appearance.sql` |
| 11 tên khoá ngoại lệch (push sinh tên dài, migration khai tên ngắn) | `0018_align_push_drift.sql` — rename có điều kiện |
| 5 index mất hậu tố `DESC` / `NULLS FIRST` so với schema khai | `0018` dựng lại đúng thứ tự sắp |

Sau khi vá: `diff` schema giữa DB dev và DB dựng-lại-từ-trắng = **rỗng**.

## Cách ly có chủ đích

`0016_rls_policies.sql` **cố tình đứng ngoài chuỗi**. Nó bật RLS fail-closed;
vào chuỗi trước khi `withWorkspace()` thật sự chạy `SET LOCAL app.workspace_id`
thì mọi query trả rỗng và app chết. Gỡ cách ly ở đợt E.

`tests/unit/migration-journal.test.ts` canh bất biến này: thêm `.sql` mà quên
khai vào journal là đỏ; file cách ly lọt vào chuỗi cũng đỏ.

## Bẫy

- `drizzle.config.ts` nạp `.env.local` **không override** biến môi trường sẵn có
  → truyền `DATABASE_URL=` ngay trước lệnh là đủ để trỏ DB khác, an toàn.
- Role `competency_app` **không** superuser, **không** BYPASSRLS — điều kiện
  tiên quyết của đợt E đã sẵn sàng (kiểm bằng `pg_roles`).
