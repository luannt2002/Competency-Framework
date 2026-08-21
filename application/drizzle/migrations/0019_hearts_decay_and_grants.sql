-- 0019_hearts_decay_and_grants.sql
--
-- Flow F, ba mục còn nợ: F8 (nghỉ học mất tim), F9 (bỏ qua task −0,5 tim),
-- F11 (ôn lại bài cũ +1 tim). Trước đợt này tim chỉ có đường MẤT khi trả lời
-- sai, không có đường kiếm lại nào ngoài hồi phục theo giờ — nên nó là một
-- chiếc xô luôn đầy, và F7 (hết tim thì chặn nộp bài) cũng chưa có.
--
-- Ba thay đổi:
--   1. `current` thành numeric(3,1) — F9 trừ nửa tim, integer không biểu diễn được.
--   2. `decayed_through` — mốc đã trừ tim tới ngày nào. Decay tính LƯỜI lúc đọc
--      (không cron), nên phải có mốc thì chạy lại mới không trừ chồng.
--   3. `heart_grants` — sổ chống cấp trùng. F11 chỉ được +1 mỗi (bài, ngày);
--      không có sổ thì mở đi mở lại một bài cũ là tim đầy vô hạn.
--
-- Idempotent: chạy lại không đổi gì.

ALTER TABLE hearts
  ALTER COLUMN current TYPE numeric(3,1) USING current::numeric(3,1);
--> statement-breakpoint

ALTER TABLE hearts
  ADD COLUMN IF NOT EXISTS decayed_through date;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "heart_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"ref_id" text NOT NULL DEFAULT '',
	"granted_on" date NOT NULL,
	"amount" numeric(3,1) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "heart_grants"
		ADD CONSTRAINT "heart_grants_workspace_id_workspaces_id_fk"
		FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "heart_grants_once_uq"
	ON "heart_grants" ("workspace_id","user_id","reason","ref_id","granted_on");
--> statement-breakpoint

-- Cấp quyền cho role app trên bảng mới.
--
-- Bảng do `postgres` tạo (DDL chạy bằng DATABASE_URL_DIRECT), nên
-- `competency_app` KHÔNG tự có quyền. `ALTER DEFAULT PRIVILEGES` chỉ phủ được
-- những DB đã chạy docker/postgres-init.sql bản mới; DB dev dựng từ trước thì
-- không. Cấp tường minh ngay trong migration là cách duy nhất chắc chắn cho mọi
-- môi trường. Bỏ qua nếu role chưa tồn tại (ví dụ CI dựng bằng một role khác).
DO $$
BEGIN
	IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'competency_app') THEN
		GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE heart_grants TO competency_app;
	END IF;
END $$;
