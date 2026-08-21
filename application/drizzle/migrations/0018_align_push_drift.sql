-- 0018_align_push_drift.sql
--
-- Hội tụ phần lệch giữa DB dev (dựng bằng `drizzle-kit push`) và DB dựng lại từ
-- chuỗi migration. Phát hiện bằng phép so THẬT: pg_dump --schema-only hai bên,
-- chuẩn hoá rồi diff → 16 chỗ khác (11 tên FK + 5 định nghĩa index).
--
-- Vì sao phải vá: từ đợt B, chuỗi migration là nguồn sự thật duy nhất. Nếu DB
-- dev giữ tên FK do push sinh (dài) trong khi migration về sau viết
-- `DROP CONSTRAINT <tên ngắn>`, lệnh đó sẽ chết trên dev mà xanh trên môi
-- trường mới — đúng loại lỗi chỉ nổ lúc deploy.
--
-- 5 index: bản push MẤT hậu tố DESC / NULLS FIRST mà schema khai. Cùng cột
-- nhưng khác thứ tự sắp, nên planner phải quét ngược.
--
-- Idempotent HAI CHIỀU: chạy trên DB đã đúng (dựng từ chuỗi) thì không làm gì;
-- chạy trên DB lệch thì kéo về đúng.

-- ===== 11 khoá ngoại: đổi tên dài (push sinh) → tên ngắn (migration khai) =====
DO $$
DECLARE
	r record;
	pairs text[][] := ARRAY[
		['audit_log',             'audit_log_workspace_id_workspaces_id_fk',              'audit_log_workspace_id_fk'],
		['node_comments',         'node_comments_node_id_roadmap_tree_nodes_id_fk',       'node_comments_node_id_fk'],
		['node_comments',         'node_comments_parent_comment_id_node_comments_id_fk',  'node_comments_parent_comment_id_fk'],
		['node_comments',         'node_comments_workspace_id_workspaces_id_fk',          'node_comments_workspace_id_fk'],
		['node_journal_entries',  'node_journal_entries_node_id_roadmap_tree_nodes_id_fk','node_journal_entries_node_id_fk'],
		['node_journal_entries',  'node_journal_entries_workspace_id_workspaces_id_fk',   'node_journal_entries_workspace_id_fk'],
		['node_resources',        'node_resources_node_id_roadmap_tree_nodes_id_fk',      'node_resources_node_id_fk'],
		['node_resources',        'node_resources_workspace_id_workspaces_id_fk',         'node_resources_workspace_id_fk'],
		['notifications',         'notifications_workspace_id_workspaces_id_fk',          'notifications_workspace_id_fk'],
		['workspace_follows',     'workspace_follows_workspace_id_workspaces_id_fk',      'workspace_follows_workspace_id_fk'],
		['workspace_members',     'workspace_members_workspace_id_workspaces_id_fk',      'workspace_members_workspace_id_fk']
	];
	i int;
BEGIN
	FOR i IN 1 .. array_length(pairs, 1) LOOP
		-- chỉ đổi khi tên dài đang tồn tại VÀ tên ngắn chưa có
		IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = pairs[i][2])
		   AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = pairs[i][3]) THEN
			EXECUTE format('ALTER TABLE %I RENAME CONSTRAINT %I TO %I', pairs[i][1], pairs[i][2], pairs[i][3]);
		END IF;
	END LOOP;
END $$;
--> statement-breakpoint

-- ===== 5 index: dựng lại đúng thứ tự sắp đã khai trong schema =====
DROP INDEX IF EXISTS "audit_log_actor_created_idx";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_log_actor_created_idx"
	ON "audit_log" USING btree ("actor_user_id", "created_at" DESC);--> statement-breakpoint

DROP INDEX IF EXISTS "audit_log_ws_created_idx";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_log_ws_created_idx"
	ON "audit_log" USING btree ("workspace_id", "created_at" DESC);--> statement-breakpoint

DROP INDEX IF EXISTS "nc_ws_node_created_idx";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "nc_ws_node_created_idx"
	ON "node_comments" USING btree ("workspace_id", "node_id", "created_at" DESC);--> statement-breakpoint

DROP INDEX IF EXISTS "nje_ws_node_created_idx";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "nje_ws_node_created_idx"
	ON "node_journal_entries" USING btree ("workspace_id", "node_id", "created_at" DESC);--> statement-breakpoint

DROP INDEX IF EXISTS "notif_recipient_unread_created_idx";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notif_recipient_unread_created_idx"
	ON "notifications" USING btree ("recipient_user_id", "read_at" NULLS FIRST, "created_at" DESC);
