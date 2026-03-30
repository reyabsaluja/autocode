import { sql } from 'drizzle-orm';
import { check, index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import { taskStatusValues, type TaskStatus } from '../../shared/domain/task';

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
