import type { CreateTaskInput } from '../../shared/contracts/tasks';
import type { TaskWorkspace } from '../../shared/domain/task-workspace';
import type { AppDatabase } from '../database/client';
import { createGitWorktreeService } from './git-worktree-service';
import { createTaskWorkspaceRepository } from './task-workspace-repository';

export function createTaskService(db: AppDatabase) {
  const gitWorktreeService = createGitWorktreeService();
  const taskWorkspaceRepository = createTaskWorkspaceRepository(db);

  return {
    listTaskWorkspaces(projectId: number): TaskWorkspace[] {
      return taskWorkspaceRepository.listTaskWorkspaces(projectId);
    },

    async createTaskWorkspace(input: CreateTaskInput): Promise<TaskWorkspace> {
      const project = taskWorkspaceRepository.findProjectById(input.projectId);

      if (!project) {
        throw new Error('Project could not be found.');
      }

      const timestamp = new Date().toISOString();
      const task = taskWorkspaceRepository.createDraftTask(
        project.id,
        input.title.trim(),
        input.description ?? null,
        timestamp
      );

      let provisionedWorktree: { branchName: string; created: boolean; worktreePath: string } | null = null;

      try {
        provisionedWorktree = await gitWorktreeService.createTaskWorktree({
          project,
          task
        });
        return taskWorkspaceRepository.finalizeTaskWorkspace({
          branchName: provisionedWorktree.branchName,
          projectId: project.id,
          taskId: task.id,
          timestamp,
          worktreePath: provisionedWorktree.worktreePath
        });
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

        taskWorkspaceRepository.markTaskFailed(task.id, message, new Date().toISOString());

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
