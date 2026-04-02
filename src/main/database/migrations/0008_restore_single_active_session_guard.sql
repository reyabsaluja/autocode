UPDATE `agent_sessions`
SET
  `status` = 'terminated',
  `pid` = NULL,
  `ended_at` = COALESCE(`ended_at`, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  `updated_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
  `last_error` = COALESCE(
    `last_error`,
    'Autocode ended this session because tasks only allow one active live session at a time.'
  )
WHERE `id` IN (
  SELECT `older`.`id`
  FROM `agent_sessions` AS `older`
  JOIN `agent_sessions` AS `newer`
    ON `older`.`task_id` = `newer`.`task_id`
   AND `older`.`status` IN ('starting', 'running')
   AND `newer`.`status` IN ('starting', 'running')
   AND (
     `newer`.`created_at` > `older`.`created_at`
     OR (`newer`.`created_at` = `older`.`created_at` AND `newer`.`id` > `older`.`id`)
   )
);--> statement-breakpoint
CREATE UNIQUE INDEX `agent_sessions_task_id_active_unique`
ON `agent_sessions` (`task_id`)
WHERE "agent_sessions"."status" in ('starting', 'running');
