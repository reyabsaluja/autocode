import type { CreateTaskInput } from '../../shared/contracts/tasks';
import type { TaskWorkspace } from '../../shared/domain/task-workspace';
import type { AppDatabase } from '../database/client';
import { createGitWorktreeService } from './git-worktree-service';
import { createTaskWorkspaceCreationService } from './task-workspace-creation-service';
import { createTaskWorkspaceRepository } from './task-workspace-repository';

interface TaskSessionCleanupService {
  deleteByTask(taskId: number): Promise<void>;
}

export function createTaskService(
  db: AppDatabase,
  sessionCleanupService?: TaskSessionCleanupService
) {
  const taskWorkspaceCreationService = createTaskWorkspaceCreationService(db);
  const taskWorkspaceRepository = createTaskWorkspaceRepository(db);
  const gitWorktreeService = createGitWorktreeService();

  return {
    listTaskWorkspaces(projectId: number): TaskWorkspace[] {
      return taskWorkspaceRepository.listTaskWorkspaces(projectId);
    },

    async createTaskWorkspace(input: CreateTaskInput): Promise<TaskWorkspace> {
      return taskWorkspaceCreationService.createTaskWorkspace(input);
    },

    async deleteTaskWorkspace(taskId: number): Promise<void> {
      const context = taskWorkspaceRepository.findTaskDeletionContextByTaskId(taskId);

      if (!context) {
        throw new Error('Task workspace could not be found.');
      }

      if (sessionCleanupService) {
        await sessionCleanupService.deleteByTask(taskId);
      }

      if (context.worktree) {
        await gitWorktreeService.cleanupTaskWorktree(
          context.project,
          context.worktree.branchName,
          context.worktree.worktreePath
        );
      }

      taskWorkspaceRepository.deleteTaskWorkspace(
        taskId,
        context.project.id,
        new Date().toISOString()
      );
    },

    async reconcileProvisioningTaskWorkspaces(): Promise<void> {
      await taskWorkspaceCreationService.reconcileProvisioningTaskWorkspaces();
    }
  };
}
