-- 0012_certificates.sql
-- Flow G (audit G8/G10/G12): bảng chứng nhận hoàn thành.
-- Một dòng / (workspace, subject) — upsert từ trang certificate khi subject
-- đủ điều kiện ≥80%. `unique_code` là mã tra cứu công khai cho /cert/[code]
-- và payload của QR in trên tờ chứng nhận.

CREATE TABLE IF NOT EXISTS "certificates" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "workspace_id" uuid NOT NULL,
    "subject_user_id" uuid NOT NULL,
    "pct" integer NOT NULL,
    "done_count" integer NOT NULL,
    "total_nodes" integer NOT NULL,
    "issued_at" timestamp with time zone DEFAULT now() NOT NULL,
    "unique_code" text NOT NULL,
    "revoked_at" timestamp with time zone,
    CONSTRAINT "certificates_workspace_fk"
        FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "certificates_workspace_subject_uq"
    ON "certificates" ("workspace_id", "subject_user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "certificates_unique_code_uq"
    ON "certificates" ("unique_code");
CREATE INDEX IF NOT EXISTS "certificates_workspace_idx"
    ON "certificates" ("workspace_id");
