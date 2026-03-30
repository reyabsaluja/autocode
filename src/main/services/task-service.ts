import type { CreateTaskInput } from '../../shared/contracts/tasks';
import type { TaskWorkspace } from '../../shared/domain/task-workspace';
import type { AppDatabase } from '../database/client';
import { createTaskWorkspaceCreationService } from './task-workspace-creation-service';
import { createTaskWorkspaceRepository } from './task-workspace-repository';

export function createTaskService(db: AppDatabase) {
  const taskWorkspaceCreationService = createTaskWorkspaceCreationService(db);
  const taskWorkspaceRepository = createTaskWorkspaceRepository(db);

  return {
    listTaskWorkspaces(projectId: number): TaskWorkspace[] {
      return taskWorkspaceRepository.listTaskWorkspaces(projectId);
    },

    async createTaskWorkspace(input: CreateTaskInput): Promise<TaskWorkspace> {
      return taskWorkspaceCreationService.createTaskWorkspace(input);
    }
  };
}
