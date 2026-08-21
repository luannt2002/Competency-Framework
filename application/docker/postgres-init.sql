-- Postgres init script — chạy MỘT LẦN khi container tạo volume mới.
-- Gắn vào docker-compose.yml qua /docker-entrypoint-initdb.d/.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";    -- cho gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";   -- hàm uuid dự phòng

-- ============================================================
-- Role của ứng dụng — KHÔNG superuser, KHÔNG bypass RLS.
--
-- Bắt buộc phải là role riêng: RLS bị Postgres BỎ QUA hoàn toàn với superuser,
-- nên nếu app nối bằng `postgres` thì mọi policy ở 0016_rls_policies.sql chỉ là
-- diễn. Trước đây role này được tạo bằng tay, không có trong repo → clone mới
-- không dựng lại được, và điều kiện tiên quyết của RLS âm thầm biến mất.
-- ============================================================
DO $$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'competency_app') THEN
		CREATE ROLE competency_app LOGIN PASSWORD 'competency_app_dev'
			NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
	END IF;
END $$;

GRANT ALL PRIVILEGES ON DATABASE competency TO postgres;
GRANT CONNECT ON DATABASE competency TO competency_app;

\connect competency

-- Quyền tối thiểu: dùng schema public + đọc/ghi mọi bảng, kể cả bảng tạo sau này.
GRANT USAGE, CREATE ON SCHEMA public TO competency_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO competency_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO competency_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
	GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO competency_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
	GRANT USAGE, SELECT ON SEQUENCES TO competency_app;
