import { desc, eq } from 'drizzle-orm';

import type { CreateTaskInput } from '../../shared/contracts/tasks';
import type { TaskWorkspace } from '../../shared/domain/task-workspace';
import type { AppDatabase } from '../database/client';
import { projectsTable, tasksTable, worktreesTable } from '../database/schema';
import { createGitWorktreeService } from './git-worktree-service';

export function createTaskService(db: AppDatabase) {
  const gitWorktreeService = createGitWorktreeService();

  return {
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

    async createTaskWorkspace(input: CreateTaskInput): Promise<TaskWorkspace> {
      const project = db
        .select()
        .from(projectsTable)
        .where(eq(projectsTable.id, input.projectId))
        .get();

      if (!project) {
        throw new Error('Project could not be found.');
      }

      const timestamp = new Date().toISOString();
      const task = db
        .insert(tasksTable)
        .values({
          projectId: project.id,
          title: input.title.trim(),
          description: input.description ?? null,
          status: 'draft',
          lastError: null,
          createdAt: timestamp,
          updatedAt: timestamp
        })
        .returning()
        .get();

      let provisionedWorktree: { branchName: string; created: boolean; worktreePath: string } | null = null;

      try {
        provisionedWorktree = await gitWorktreeService.createTaskWorktree({
          project,
          task
        });
        const workspace = provisionedWorktree;

        const result = db.transaction((tx) => {
          const updatedTask = tx
            .update(tasksTable)
            .set({
              status: 'ready',
              lastError: null,
              updatedAt: timestamp
            })
            .where(eq(tasksTable.id, task.id))
            .returning()
            .get();

          const worktree = tx
            .insert(worktreesTable)
            .values({
              projectId: project.id,
              taskId: task.id,
              branchName: workspace.branchName,
              worktreePath: workspace.worktreePath,
              status: 'ready',
              createdAt: timestamp,
              updatedAt: timestamp
            })
            .onConflictDoUpdate({
              target: worktreesTable.taskId,
              set: {
                branchName: workspace.branchName,
                worktreePath: workspace.worktreePath,
                status: 'ready',
                updatedAt: timestamp
              }
            })
            .returning()
            .get();

          tx.update(projectsTable)
            .set({
              updatedAt: timestamp
            })
            .where(eq(projectsTable.id, project.id))
            .run();

          return {
            task: updatedTask,
            worktree
          };
        });

        return result;
      } catch (error) {
        const message = extractErrorMessage(error);

        if (provisionedWorktree?.created) {
          try {
            await gitWorktreeService.cleanupTaskWorktree(
              project,
              provisionedWorktree.branchName,
              provisionedWorktree.worktreePath
            );
          } catch {
            // If cleanup fails, we still persist the task failure for later inspection.
          }
        }

        db.update(tasksTable)
          .set({
            status: 'failed',
            lastError: message,
            updatedAt: new Date().toISOString()
          })
          .where(eq(tasksTable.id, task.id))
          .run();

        throw new Error(message);
      }
    }
  };
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Autocode could not create the task workspace.';
}
