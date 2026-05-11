CREATE TYPE "public"."exercise_kind" AS ENUM('mcq', 'mcq_multi', 'fill_blank', 'order_steps', 'type_answer', 'code_block_review');--> statement-breakpoint
CREATE TYPE "public"."export_format" AS ENUM('pdf', 'xlsx', 'json');--> statement-breakpoint
CREATE TYPE "public"."export_status" AS ENUM('queued', 'running', 'done', 'failed');--> statement-breakpoint
CREATE TYPE "public"."lesson_status" AS ENUM('not_started', 'in_progress', 'completed', 'mastered');--> statement-breakpoint
CREATE TYPE "public"."level_source" AS ENUM('self_claimed', 'learned', 'both');--> statement-breakpoint
CREATE TYPE "public"."org_role" AS ENUM('owner', 'admin', 'member', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."roadmap_task_kind" AS ENUM('reading', 'lab', 'project', 'assessment');--> statement-breakpoint
CREATE TYPE "public"."user_task_status" AS ENUM('todo', 'doing', 'done', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."template_author_kind" AS ENUM('system', 'community');--> statement-breakpoint
CREATE TYPE "public"."user_level_status" AS ENUM('locked', 'unlocked', 'completed');--> statement-breakpoint
CREATE TYPE "public"."workspace_visibility" AS ENUM('private', 'public-readonly');--> statement-breakpoint
CREATE TYPE "public"."evidence_kind" AS ENUM('lab', 'project', 'peer_review', 'manager_review');--> statement-breakpoint
CREATE TYPE "public"."skill_audit_action" AS ENUM('level_changed', 'evidence_added', 'verified', 'decayed');--> statement-breakpoint
CREATE TYPE "public"."daily_task_kind" AS ENUM('lesson', 'lab', 'weak_skill_review', 'streak_keeper', 'stretch');--> statement-breakpoint
CREATE TYPE "public"."daily_task_status" AS ENUM('todo', 'done', 'skipped', 'carried_over');--> statement-breakpoint
CREATE TYPE "public"."import_source_kind" AS ENUM('markdown', 'csv_skills', 'csv_levels');--> statement-breakpoint
CREATE TYPE "public"."import_status" AS ENUM('running', 'succeeded', 'failed');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "activity_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "badges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"icon" text,
	"rule" jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "competency_levels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"code" text NOT NULL,
	"label" text NOT NULL,
	"numeric_value" integer NOT NULL,
	"description" text,
	"examples" text,
	"color" text,
	"display_order" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "exercises" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"lesson_id" uuid NOT NULL,
	"kind" "exercise_kind" NOT NULL,
	"prompt_md" text NOT NULL,
	"payload" jsonb NOT NULL,
	"explanation_md" text,
	"xp_award" integer DEFAULT 10,
	"display_order" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "export_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"format" "export_format",
	"status" "export_status" DEFAULT 'queued',
	"file_url" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "framework_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"domain" text,
	"author_kind" "template_author_kind" DEFAULT 'system',
	"author_user_id" uuid,
	"is_published" boolean DEFAULT true,
	"forks_count" integer DEFAULT 0,
	"payload" jsonb NOT NULL,
	"version" text DEFAULT '1.0.0',
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "framework_templates_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hearts" (
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"current" integer DEFAULT 5,
	"max" integer DEFAULT 5,
	"next_refill_at" timestamp with time zone,
	CONSTRAINT "hearts_workspace_id_user_id_pk" PRIMARY KEY("workspace_id","user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "labs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"week_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"body_md" text,
	"est_minutes" integer DEFAULT 30,
	"display_order" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lesson_skill_map" (
	"lesson_id" uuid NOT NULL,
	"skill_id" uuid NOT NULL,
	"contributes_to_level" text NOT NULL,
	"weight" integer DEFAULT 1,
	CONSTRAINT "lesson_skill_map_lesson_id_skill_id_pk" PRIMARY KEY("lesson_id","skill_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lessons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"module_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"intro_md" text,
	"est_minutes" integer DEFAULT 8,
	"display_order" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "level_tracks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"level_code" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"display_order" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "modules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"week_id" uuid NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"display_order" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "org_members" (
	"org_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "org_role" DEFAULT 'member' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "org_members_org_id_user_id_pk" PRIMARY KEY("org_id","user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "review_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"ref_kind" text,
	"ref_id" uuid NOT NULL,
	"ease_factor" numeric(4, 2) DEFAULT '2.5',
	"interval_days" integer DEFAULT 1,
	"due_at" timestamp with time zone,
	"last_reviewed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "skill_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"color" text,
	"icon" text,
	"display_order" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"tags" text[] DEFAULT '{}'::text[],
	"display_order" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "streaks" (
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"current_streak" integer DEFAULT 0,
	"longest_streak" integer DEFAULT 0,
	"last_active_date" date,
	"freeze_count" integer DEFAULT 0,
	CONSTRAINT "streaks_workspace_id_user_id_pk" PRIMARY KEY("workspace_id","user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_badges" (
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"badge_id" uuid NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "user_badges_workspace_id_user_id_badge_id_pk" PRIMARY KEY("workspace_id","user_id","badge_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_exercise_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"exercise_id" uuid NOT NULL,
	"answer" jsonb,
	"is_correct" boolean,
	"time_taken_ms" integer,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_lab_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"lab_id" uuid NOT NULL,
	"status" text DEFAULT 'todo',
	"evidence_urls" text[] DEFAULT '{}'::text[],
	"note" text,
	"completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_lesson_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"lesson_id" uuid NOT NULL,
	"status" "lesson_status" DEFAULT 'not_started',
	"best_score" numeric(4, 3),
	"attempts" integer DEFAULT 0,
	"completed_at" timestamp with time zone,
	"last_attempt_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_level_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"level_code" text NOT NULL,
	"status" "user_level_status" DEFAULT 'locked',
	"unlocked_at" timestamp with time zone,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_skill_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"skill_id" uuid NOT NULL,
	"level_code" text,
	"level_source" "level_source" DEFAULT 'self_claimed',
	"note_md" text,
	"evidence_urls" text[] DEFAULT '{}'::text[],
	"why_this_level" text,
	"target_level_code" text,
	"crowns" integer DEFAULT 0,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_week_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"week_id" uuid NOT NULL,
	"body_md" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_week_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"week_id" uuid NOT NULL,
	"pct_complete" numeric(4, 3) DEFAULT '0',
	"unlocked" boolean DEFAULT false,
	"unlocked_at" timestamp with time zone,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "weeks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"track_id" uuid NOT NULL,
	"week_index" integer NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"goals" text[] DEFAULT '{}'::text[],
	"keywords" text[] DEFAULT '{}'::text[],
	"est_hours" integer DEFAULT 8,
	"display_order" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid,
	"org_id" uuid,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"icon" text,
	"color" text,
	"framework_template_id" uuid,
	"visibility" "workspace_visibility" DEFAULT 'private',
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "xp_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"reason" text NOT NULL,
	"ref_kind" text,
	"ref_id" uuid,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "evidence_grades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"skill_id" uuid NOT NULL,
	"kind" "evidence_kind" NOT NULL,
	"score" integer NOT NULL,
	"evidence_url" text,
	"reviewer_user_id" uuid,
	"reviewed_at" timestamp with time zone,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "role_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"parent_role_id" uuid,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "role_skill_requirements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"skill_id" uuid NOT NULL,
	"required_level_code" text NOT NULL,
	"weight" numeric(4, 2) DEFAULT '1.00'
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "skill_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"skill_id" uuid NOT NULL,
	"action" "skill_audit_action" NOT NULL,
	"from_value" text,
	"to_value" text,
	"reason" text,
	"actor_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_role_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"target_date" date,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "daily_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"plan_date" date NOT NULL,
	"kind" "daily_task_kind" NOT NULL,
	"ref_kind" text NOT NULL,
	"ref_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" "daily_task_status" DEFAULT 'todo' NOT NULL,
	"est_minutes" integer DEFAULT 10 NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_planner_settings" (
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"daily_goal_xp" integer DEFAULT 60 NOT NULL,
	"preferred_kinds" text[] DEFAULT '{}'::text[] NOT NULL,
	"excluded_skill_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "user_planner_settings_workspace_id_user_id_pk" PRIMARY KEY("workspace_id","user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "import_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"source_kind" "import_source_kind" NOT NULL,
	"source_ref" text NOT NULL,
	"status" "import_status" DEFAULT 'running' NOT NULL,
	"payload" jsonb,
	"error_text" text,
	"started_at" timestamp with time zone DEFAULT now(),
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "badges" ADD CONSTRAINT "badges_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "competency_levels" ADD CONSTRAINT "competency_levels_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "exercises" ADD CONSTRAINT "exercises_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "exercises" ADD CONSTRAINT "exercises_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "export_jobs" ADD CONSTRAINT "export_jobs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hearts" ADD CONSTRAINT "hearts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "labs" ADD CONSTRAINT "labs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "labs" ADD CONSTRAINT "labs_week_id_weeks_id_fk" FOREIGN KEY ("week_id") REFERENCES "public"."weeks"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lesson_skill_map" ADD CONSTRAINT "lesson_skill_map_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lesson_skill_map" ADD CONSTRAINT "lesson_skill_map_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lessons" ADD CONSTRAINT "lessons_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lessons" ADD CONSTRAINT "lessons_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "level_tracks" ADD CONSTRAINT "level_tracks_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "modules" ADD CONSTRAINT "modules_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "modules" ADD CONSTRAINT "modules_week_id_weeks_id_fk" FOREIGN KEY ("week_id") REFERENCES "public"."weeks"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "org_members" ADD CONSTRAINT "org_members_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "review_schedules" ADD CONSTRAINT "review_schedules_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "skill_categories" ADD CONSTRAINT "skill_categories_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "skills" ADD CONSTRAINT "skills_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "skills" ADD CONSTRAINT "skills_category_id_skill_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."skill_categories"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "streaks" ADD CONSTRAINT "streaks_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_badge_id_badges_id_fk" FOREIGN KEY ("badge_id") REFERENCES "public"."badges"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_exercise_attempts" ADD CONSTRAINT "user_exercise_attempts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_exercise_attempts" ADD CONSTRAINT "user_exercise_attempts_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_lab_progress" ADD CONSTRAINT "user_lab_progress_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_lab_progress" ADD CONSTRAINT "user_lab_progress_lab_id_labs_id_fk" FOREIGN KEY ("lab_id") REFERENCES "public"."labs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_lesson_progress" ADD CONSTRAINT "user_lesson_progress_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_lesson_progress" ADD CONSTRAINT "user_lesson_progress_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_level_progress" ADD CONSTRAINT "user_level_progress_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_skill_progress" ADD CONSTRAINT "user_skill_progress_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_skill_progress" ADD CONSTRAINT "user_skill_progress_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_week_notes" ADD CONSTRAINT "user_week_notes_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_week_notes" ADD CONSTRAINT "user_week_notes_week_id_weeks_id_fk" FOREIGN KEY ("week_id") REFERENCES "public"."weeks"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_week_progress" ADD CONSTRAINT "user_week_progress_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_week_progress" ADD CONSTRAINT "user_week_progress_week_id_weeks_id_fk" FOREIGN KEY ("week_id") REFERENCES "public"."weeks"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "weeks" ADD CONSTRAINT "weeks_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "weeks" ADD CONSTRAINT "weeks_track_id_level_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."level_tracks"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "xp_events" ADD CONSTRAINT "xp_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "evidence_grades" ADD CONSTRAINT "evidence_grades_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "evidence_grades" ADD CONSTRAINT "evidence_grades_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "role_profiles" ADD CONSTRAINT "role_profiles_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "role_skill_requirements" ADD CONSTRAINT "role_skill_requirements_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "role_skill_requirements" ADD CONSTRAINT "role_skill_requirements_role_id_role_profiles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."role_profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "role_skill_requirements" ADD CONSTRAINT "role_skill_requirements_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "skill_audit_log" ADD CONSTRAINT "skill_audit_log_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "skill_audit_log" ADD CONSTRAINT "skill_audit_log_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_role_targets" ADD CONSTRAINT "user_role_targets_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_role_targets" ADD CONSTRAINT "user_role_targets_role_id_role_profiles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."role_profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "daily_tasks" ADD CONSTRAINT "daily_tasks_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_planner_settings" ADD CONSTRAINT "user_planner_settings_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "import_logs" ADD CONSTRAINT "import_logs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "activity_ws_user_created_idx" ON "activity_log" USING btree ("workspace_id","user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "badges_ws_slug_uq" ON "badges" USING btree ("workspace_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "competency_levels_ws_code_uq" ON "competency_levels" USING btree ("workspace_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "lessons_ws_mod_slug_uq" ON "lessons" USING btree ("workspace_id","module_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "level_tracks_ws_lvl_uq" ON "level_tracks" USING btree ("workspace_id","level_code");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "skill_categories_ws_slug_uq" ON "skill_categories" USING btree ("workspace_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "skills_ws_slug_uq" ON "skills" USING btree ("workspace_id","slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "skills_ws_cat_idx" ON "skills" USING btree ("workspace_id","category_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "uea_ws_user_created_idx" ON "user_exercise_attempts" USING btree ("workspace_id","user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ulabp_ws_user_lab_uq" ON "user_lab_progress" USING btree ("workspace_id","user_id","lab_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ulp_ws_user_lesson_uq" ON "user_lesson_progress" USING btree ("workspace_id","user_id","lesson_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ulp_ws_user_idx" ON "user_lesson_progress" USING btree ("workspace_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ulp2_ws_user_lvl_uq" ON "user_level_progress" USING btree ("workspace_id","user_id","level_code");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "usp_ws_user_skill_uq" ON "user_skill_progress" USING btree ("workspace_id","user_id","skill_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "usp_ws_user_idx" ON "user_skill_progress" USING btree ("workspace_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "uwn_ws_user_wk_idx" ON "user_week_notes" USING btree ("workspace_id","user_id","week_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uwp_ws_user_wk_uq" ON "user_week_progress" USING btree ("workspace_id","user_id","week_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "weeks_ws_track_idx_uq" ON "weeks" USING btree ("workspace_id","track_id","week_index");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "weeks_ws_track_idx" ON "weeks" USING btree ("workspace_id","track_id","week_index");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "workspaces_owner_slug_uq" ON "workspaces" USING btree ("owner_user_id","slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workspaces_owner_idx" ON "workspaces" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "xp_ws_user_created_idx" ON "xp_events" USING btree ("workspace_id","user_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "evgrades_ws_user_skill_idx" ON "evidence_grades" USING btree ("workspace_id","user_id","skill_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "evgrades_ws_kind_idx" ON "evidence_grades" USING btree ("workspace_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "role_profiles_ws_slug_uq" ON "role_profiles" USING btree ("workspace_id","slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "role_profiles_ws_parent_idx" ON "role_profiles" USING btree ("workspace_id","parent_role_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "rsr_ws_role_skill_uq" ON "role_skill_requirements" USING btree ("workspace_id","role_id","skill_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rsr_ws_role_idx" ON "role_skill_requirements" USING btree ("workspace_id","role_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sal_ws_user_skill_created_idx" ON "skill_audit_log" USING btree ("workspace_id","user_id","skill_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "urt_ws_user_role_uq" ON "user_role_targets" USING btree ("workspace_id","user_id","role_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "urt_ws_user_idx" ON "user_role_targets" USING btree ("workspace_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "daily_tasks_ws_user_date_idx" ON "daily_tasks" USING btree ("workspace_id","user_id","plan_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "daily_tasks_ws_user_status_idx" ON "daily_tasks" USING btree ("workspace_id","user_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "daily_tasks_ws_ref_idx" ON "daily_tasks" USING btree ("workspace_id","ref_kind","ref_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "daily_tasks_ws_user_date_ref_uq" ON "daily_tasks" USING btree ("workspace_id","user_id","plan_date","ref_kind","ref_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "import_logs_ws_kind_started_idx" ON "import_logs" USING btree ("workspace_id","source_kind","started_at");