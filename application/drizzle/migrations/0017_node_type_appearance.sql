-- 0017_node_type_appearance.sql
--
-- Bảng này đã tồn tại trong DB dev từ trước, nhưng KHÔNG do migration nào tạo:
-- nó vào DB qua `drizzle-kit push` (diff thẳng từ src/lib/db/schema-appearance.ts).
-- Đợt B (PLAN_FIX_ALL.md) chốt chuỗi migration là nguồn sự thật duy nhất, nên
-- phải có file này thì dựng lại từ DB trắng mới ra đúng schema hiện tại.
--
-- Phát hiện bằng phép so thật: DB dev 50 bảng, DB dựng lại từ chuỗi migration
-- 49 bảng — chênh đúng bảng này.
--
-- Idempotent: chạy lại trên DB đã có bảng thì không làm gì.

CREATE TABLE IF NOT EXISTS "node_type_appearance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"node_type" text NOT NULL,
	"icon" text,
	"color" text,
	"updated_at" text
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "node_type_appearance"
		ADD CONSTRAINT "node_type_appearance_workspace_id_workspaces_id_fk"
		FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "nta_ws_type_uq" ON "node_type_appearance" ("workspace_id","node_type");
