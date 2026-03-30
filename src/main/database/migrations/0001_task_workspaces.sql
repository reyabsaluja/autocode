CREATE TABLE `worktrees` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`task_id` integer NOT NULL,
	`branch_name` text NOT NULL,
	`worktree_path` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "worktrees_status_check" CHECK("worktrees"."status" in ('provisioning', 'ready', 'dirty', 'archived', 'failed'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `worktrees_task_id_unique` ON `worktrees` (`task_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `worktrees_path_unique` ON `worktrees` (`worktree_path`);--> statement-breakpoint
CREATE INDEX `worktrees_branch_name_idx` ON `worktrees` (`branch_name`);--> statement-breakpoint
CREATE INDEX `worktrees_project_id_idx` ON `worktrees` (`project_id`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`status` text NOT NULL,
	`last_error` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "tasks_status_check" CHECK("__new_tasks"."status" in ('draft', 'ready', 'in_progress', 'needs_review', 'completed', 'archived', 'failed'))
);
--> statement-breakpoint
INSERT INTO `__new_tasks`("id", "project_id", "title", "description", "status", "last_error", "created_at", "updated_at")
SELECT
	"id",
	"project_id",
	"title",
	"description",
	CASE
		WHEN "status" = 'queued' THEN 'ready'
		WHEN "status" = 'running' THEN 'in_progress'
		WHEN "status" = 'review' THEN 'needs_review'
		WHEN "status" = 'cancelled' THEN 'archived'
		ELSE "status"
	END,
	NULL,
	"created_at",
	"updated_at"
FROM `tasks`;--> statement-breakpoint
DROP TABLE `tasks`;--> statement-breakpoint
ALTER TABLE `__new_tasks` RENAME TO `tasks`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `tasks_project_id_idx` ON `tasks` (`project_id`);--> statement-breakpoint
CREATE INDEX `tasks_status_idx` ON `tasks` (`status`);
