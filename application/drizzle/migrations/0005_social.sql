-- 0005_social.sql
-- Social / community depth: per-node comment threads, workspace follows, and a
-- per-user notifications inbox. Idempotent: every CREATE / ALTER is guarded
-- with IF NOT EXISTS or a `duplicate_object` swallow so re-running on a
-- partially-migrated DB is safe. Mirrors the pattern in 0003_node_journal.sql
-- and 0004_node_resources.sql.
--
-- See:
--   src/lib/db/schema-social.ts — Drizzle mirror.
--   src/actions/comments.ts      — comment mutations.
--   src/actions/follows.ts       — follow / unfollow.
--   src/actions/notifications.ts — inbox.

/* ============================ node_comments ============================ */
CREATE TABLE IF NOT EXISTS "node_comments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL,
  "node_id" uuid NOT NULL,
  "author_user_id" uuid NOT NULL,
  "parent_comment_id" uuid,
  "body" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE "node_comments"
    ADD CONSTRAINT "node_comments_workspace_id_fk"
    FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "node_comments"
    ADD CONSTRAINT "node_comments_node_id_fk"
    FOREIGN KEY ("node_id") REFERENCES "public"."roadmap_tree_nodes"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "node_comments"
    ADD CONSTRAINT "node_comments_parent_comment_id_fk"
    FOREIGN KEY ("parent_comment_id") REFERENCES "public"."node_comments"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "nc_ws_node_created_idx"
  ON "node_comments" USING btree ("workspace_id", "node_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "nc_author_idx"
  ON "node_comments" USING btree ("author_user_id");

/* ============================ workspace_follows ============================ */
CREATE TABLE IF NOT EXISTS "workspace_follows" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "workspace_id" uuid NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE "workspace_follows"
    ADD CONSTRAINT "workspace_follows_workspace_id_fk"
    FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "wf_user_ws_uq"
  ON "workspace_follows" USING btree ("user_id", "workspace_id");

CREATE INDEX IF NOT EXISTS "wf_user_idx"
  ON "workspace_follows" USING btree ("user_id");

CREATE INDEX IF NOT EXISTS "wf_ws_idx"
  ON "workspace_follows" USING btree ("workspace_id");

/* ============================ notifications ============================ */
CREATE TABLE IF NOT EXISTS "notifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "recipient_user_id" uuid NOT NULL,
  "kind" varchar(32) NOT NULL,
  "workspace_id" uuid,
  "resource_type" varchar(32),
  "resource_id" varchar(128),
  "title" text NOT NULL,
  "body" text,
  "read_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE "notifications"
    ADD CONSTRAINT "notifications_workspace_id_fk"
    FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id")
    ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "notifications"
    ADD CONSTRAINT "notifications_kind_check"
    CHECK ("kind" IN (
      'comment.reply',
      'follow.new',
      'invite.received',
      'workspace.shared',
      'milestone.completed'
    ));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Inbox access path: list this user's notifications, unread first, newest first.
CREATE INDEX IF NOT EXISTS "notif_recipient_unread_created_idx"
  ON "notifications" USING btree ("recipient_user_id", "read_at" NULLS FIRST, "created_at" DESC);
