PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_agent_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`task_id` integer NOT NULL,
	`worktree_id` integer NOT NULL,
	`provider` text NOT NULL,
	`status` text NOT NULL,
	`command` text NOT NULL,
	`pid` integer,
	`exit_code` integer,
	`last_error` text,
	`last_event_seq` integer DEFAULT 0 NOT NULL,
	`transcript_path` text NOT NULL,
	`started_at` text,
	`ended_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`worktree_id`) REFERENCES `worktrees`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "agent_sessions_provider_check" CHECK("__new_agent_sessions"."provider" in ('codex', 'claude-code', 'terminal')),
	CONSTRAINT "agent_sessions_status_check" CHECK("__new_agent_sessions"."status" in ('starting', 'running', 'completed', 'failed', 'terminated'))
);
--> statement-breakpoint
INSERT INTO `__new_agent_sessions`("id", "task_id", "worktree_id", "provider", "status", "command", "pid", "exit_code", "last_error", "last_event_seq", "transcript_path", "started_at", "ended_at", "created_at", "updated_at") SELECT "id", "task_id", "worktree_id", "provider", "status", "command", "pid", "exit_code", "last_error", "last_event_seq", "transcript_path", "started_at", "ended_at", "created_at", "updated_at" FROM `agent_sessions`;--> statement-breakpoint
DROP TABLE `agent_sessions`;--> statement-breakpoint
ALTER TABLE `__new_agent_sessions` RENAME TO `agent_sessions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `agent_sessions_task_provider_active_unique` ON `agent_sessions` (`task_id`,`provider`) WHERE "agent_sessions"."status" in ('starting', 'running');--> statement-breakpoint
CREATE INDEX `agent_sessions_created_at_idx` ON `agent_sessions` (`created_at`);--> statement-breakpoint
CREATE INDEX `agent_sessions_status_idx` ON `agent_sessions` (`status`);--> statement-breakpoint
CREATE INDEX `agent_sessions_task_id_idx` ON `agent_sessions` (`task_id`);