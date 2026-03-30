import { desc, eq } from 'drizzle-orm';

import type { Project } from '../../shared/domain/project';
import type { TaskWorkspace } from '../../shared/domain/task-workspace';
import type { Task, TaskStatus } from '../../shared/domain/task';
import type { Worktree, WorktreeStatus } from '../../shared/domain/worktree';
import type { AppDatabase } from '../database/client';
import { projectsTable, tasksTable, worktreesTable } from '../database/schema';

export interface TaskWorkspaceContext {
  project: Project;
  task: Task;
  worktree: Worktree;
}

export interface FinalizeTaskWorkspaceInput {
  branchName: string;
  projectId: number;
  taskId: number;
  timestamp: string;
  worktreePath: string;
}

export function createTaskWorkspaceRepository(db: AppDatabase) {
  return {
    findProjectById(projectId: number): Project | null {
      return db
        .select()
        .from(projectsTable)
        .where(eq(projectsTable.id, projectId))
        .get() ?? null;
    },

    listTaskWorkspaces(projectId: number): TaskWorkspace[] {
      const rows = db
        .select({
          task: tasksTable,
          worktree: worktreesTable
        })
        .from(tasksTable)
        .leftJoin(worktreesTable, eq(worktreesTable.taskId, tasksTable.id))
        .where(eq(tasksTable.projectId, projectId))
        .orderBy(desc(tasksTable.updatedAt), desc(tasksTable.id))
        .all();

      return rows.map((row) => ({
        task: row.task,
        worktree: row.worktree?.id ? row.worktree : null
      }));
    },

    createDraftTask(projectId: number, title: string, description: string | null, timestamp: string): Task {
      return db
        .insert(tasksTable)
        .values({
          projectId,
          title,
          description,
          status: 'draft',
          lastError: null,
          createdAt: timestamp,
          updatedAt: timestamp
        })
        .returning()
        .get();
    },

    finalizeTaskWorkspace(input: FinalizeTaskWorkspaceInput): TaskWorkspace {
      return db.transaction((tx) => {
        const task = tx
          .update(tasksTable)
          .set({
            status: 'ready',
            lastError: null,
            updatedAt: input.timestamp
          })
          .where(eq(tasksTable.id, input.taskId))
          .returning()
          .get();

        const worktree = tx
          .insert(worktreesTable)
          .values({
            projectId: input.projectId,
            taskId: input.taskId,
            branchName: input.branchName,
            worktreePath: input.worktreePath,
            status: 'ready',
            createdAt: input.timestamp,
            updatedAt: input.timestamp
          })
          .onConflictDoUpdate({
            target: worktreesTable.taskId,
            set: {
              branchName: input.branchName,
              worktreePath: input.worktreePath,
              status: 'ready',
              updatedAt: input.timestamp
            }
          })
          .returning()
          .get();

        tx.update(projectsTable)
          .set({
            updatedAt: input.timestamp
          })
          .where(eq(projectsTable.id, input.projectId))
          .run();

        return {
          task,
          worktree
        };
      });
    },

    markTaskFailed(taskId: number, message: string, timestamp: string): void {
      db.update(tasksTable)
        .set({
          status: 'failed',
          lastError: message,
          updatedAt: timestamp
        })
        .where(eq(tasksTable.id, taskId))
        .run();
    },

    findWorkspaceContextByTaskId(taskId: number): TaskWorkspaceContext | null {
      const row = db
        .select({
          project: projectsTable,
          task: tasksTable,
          worktree: worktreesTable
        })
        .from(tasksTable)
        .innerJoin(projectsTable, eq(projectsTable.id, tasksTable.projectId))
        .innerJoin(worktreesTable, eq(worktreesTable.taskId, tasksTable.id))
        .where(eq(tasksTable.id, taskId))
        .get();

      if (!row) {
        return null;
      }

      return {
        project: row.project,
        task: row.task,
        worktree: row.worktree
      };
    },

    touchTaskWorkspace(taskId: number, projectId: number, nextStatus: TaskStatus, timestamp: string): void {
      db.transaction((tx) => {
        tx.update(tasksTable)
          .set({
            lastError: null,
            status: nextStatus,
            updatedAt: timestamp
          })
          .where(eq(tasksTable.id, taskId))
          .run();

        tx.update(worktreesTable)
          .set({
            status: 'ready',
            updatedAt: timestamp
          })
          .where(eq(worktreesTable.taskId, taskId))
          .run();

        tx.update(projectsTable)
          .set({
            updatedAt: timestamp
          })
          .where(eq(projectsTable.id, projectId))
          .run();
      });
    },

    recordWorkspaceObservation(taskId: number, worktreeStatus: WorktreeStatus, lastError: string | null, timestamp: string): void {
      db.transaction((tx) => {
        tx.update(tasksTable)
          .set({
            lastError
          })
          .where(eq(tasksTable.id, taskId))
          .run();

        tx.update(worktreesTable)
          .set({
            status: worktreeStatus,
            updatedAt: timestamp
          })
          .where(eq(worktreesTable.taskId, taskId))
          .run();
      });
    }
  };
}
