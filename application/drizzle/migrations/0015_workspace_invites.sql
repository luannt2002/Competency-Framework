-- 0015_workspace_invites.sql
-- Flow D (audit D2.5): invite-token cho người dùng CHƯA tồn tại.
-- Khi email không resolve ra user qua Supabase Admin API, ghi một dòng
-- pending ở đây thay vì throw. Auto-join khi người đó đăng nhập lần đầu
-- (src/lib/auth/join-pending-invites.ts, gọi từ auth callback).

CREATE TABLE IF NOT EXISTS "workspace_invites" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "workspace_id" uuid NOT NULL,
    "email" text NOT NULL,
    "role" varchar(32) DEFAULT 'learner' NOT NULL,
    "invited_by" uuid,
    "invite_token" text NOT NULL,
    "status" text DEFAULT 'pending' NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "accepted_at" timestamp with time zone,
    "accepted_by_user_id" uuid,
    CONSTRAINT "workspace_invites_workspace_fk"
        FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE
);

-- Chỉ một lời mời pending cho mỗi (workspace, email); accepted/revoked
-- không chiếm chỗ nên có thể mời lại cùng email.
CREATE UNIQUE INDEX IF NOT EXISTS "workspace_invites_ws_email_pending_uq"
    ON "workspace_invites" ("workspace_id", "email")
    WHERE status = 'pending';
CREATE UNIQUE INDEX IF NOT EXISTS "workspace_invites_token_uq"
    ON "workspace_invites" ("invite_token");
CREATE INDEX IF NOT EXISTS "workspace_invites_ws_idx"
    ON "workspace_invites" ("workspace_id");
CREATE INDEX IF NOT EXISTS "workspace_invites_email_idx"
    ON "workspace_invites" ("email");
