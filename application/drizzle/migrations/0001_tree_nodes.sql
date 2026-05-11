ALTER TYPE "public"."level_source" ADD VALUE 'verified';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "roadmap_tree_nodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"parent_id" uuid,
	"node_type" text NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"body_md" text,
	"order_index" integer DEFAULT 0 NOT NULL,
	"est_minutes" integer,
	"meta" jsonb DEFAULT '{}'::jsonb,
	"path_str" text DEFAULT '' NOT NULL,
	"depth" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_node_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"node_id" uuid NOT NULL,
	"status" text DEFAULT 'todo',
	"completed_at" timestamp with time zone,
	"evidence_urls" text[] DEFAULT '{}'::text[],
	"note" text,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "roadmap_tree_nodes" ADD CONSTRAINT "roadmap_tree_nodes_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_node_progress" ADD CONSTRAINT "user_node_progress_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_node_progress" ADD CONSTRAINT "user_node_progress_node_id_roadmap_tree_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."roadmap_tree_nodes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "rtn_ws_slug_uq" ON "roadmap_tree_nodes" USING btree ("workspace_id","slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rtn_ws_parent_idx" ON "roadmap_tree_nodes" USING btree ("workspace_id","parent_id","order_index");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rtn_ws_type_idx" ON "roadmap_tree_nodes" USING btree ("workspace_id","node_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rtn_path_idx" ON "roadmap_tree_nodes" USING btree ("workspace_id","path_str");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "unp_ws_user_node_uq" ON "user_node_progress" USING btree ("workspace_id","user_id","node_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "unp_ws_user_idx" ON "user_node_progress" USING btree ("workspace_id","user_id");