import { sql } from 'drizzle-orm';
import { check, index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

import { taskStatusValues, type TaskStatus } from '../../shared/domain/task';
import { worktreeStatusValues, type WorktreeStatus } from '../../shared/domain/worktree';

export const projectsTable = sqliteTable('projects', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  repoPath: text('repo_path').notNull().unique(),
  gitRoot: text('git_root').notNull().unique(),
  defaultBranch: text('default_branch'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull()
});

export const tasksTable = sqliteTable(
  'tasks',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    projectId: integer('project_id')
      .notNull()
      .references(() => projectsTable.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    status: text('status').$type<TaskStatus>().notNull(),
    statusBeforeFailure: text('status_before_failure').$type<TaskStatus>(),
    lastError: text('last_error'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull()
  },
  (table) => ({
    projectIdIdx: index('tasks_project_id_idx').on(table.projectId),
    statusIdx: index('tasks_status_idx').on(table.status),
    statusCheck: check(
      'tasks_status_check',
      sql`${table.status} in (${sql.raw(taskStatusValues.map((status) => `'${status}'`).join(', '))})`
    )
  })
);

export const worktreesTable = sqliteTable(
  'worktrees',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    projectId: integer('project_id')
      .notNull()
      .references(() => projectsTable.id, { onDelete: 'cascade' }),
    taskId: integer('task_id')
      .notNull()
      .references(() => tasksTable.id, { onDelete: 'cascade' }),
    branchName: text('branch_name').notNull(),
    worktreePath: text('worktree_path').notNull(),
    status: text('status').$type<WorktreeStatus>().notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull()
  },
  (table) => ({
    taskIdUnique: uniqueIndex('worktrees_task_id_unique').on(table.taskId),
    pathUnique: uniqueIndex('worktrees_path_unique').on(table.worktreePath),
    branchIdx: index('worktrees_branch_name_idx').on(table.branchName),
    projectIdx: index('worktrees_project_id_idx').on(table.projectId),
    statusCheck: check(
      'worktrees_status_check',
      sql`${table.status} in (${sql.raw(worktreeStatusValues.map((status) => `'${status}'`).join(', '))})`
    )
  })
);
