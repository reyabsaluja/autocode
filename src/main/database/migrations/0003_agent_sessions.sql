CREATE TABLE `agent_sessions` (
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
	CONSTRAINT "agent_sessions_provider_check" CHECK("agent_sessions"."provider" in ('codex')),
	CONSTRAINT "agent_sessions_status_check" CHECK("agent_sessions"."status" in ('starting', 'running', 'completed', 'failed', 'terminated'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `agent_sessions_task_id_active_unique` ON `agent_sessions` (`task_id`) WHERE "agent_sessions"."status" in ('starting', 'running');--> statement-breakpoint
CREATE INDEX `agent_sessions_created_at_idx` ON `agent_sessions` (`created_at`);--> statement-breakpoint
CREATE INDEX `agent_sessions_status_idx` ON `agent_sessions` (`status`);--> statement-breakpoint
CREATE INDEX `agent_sessions_task_id_idx` ON `agent_sessions` (`task_id`);