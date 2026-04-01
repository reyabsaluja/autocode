import type { IpcMainInvokeEvent } from 'electron';

import {
  type CreateTaskInput,
  type ListTasksByProjectInput,
  createTaskInputSchema,
  createTaskResultSchema,
  listTasksByProjectInputSchema,
  listTasksByProjectResultSchema
} from '../../shared/contracts/tasks';
import { taskChannels } from '../../shared/ipc/channels';
import { createTaskService } from '../services/task-service';
import { handleValidatedIpc } from './handle-validated-ipc';

export type TaskService = ReturnType<typeof createTaskService>;

export function registerTaskHandlers(taskService: TaskService): void {
  handleValidatedIpc(taskChannels.listByProject, {
    handler: (_event: IpcMainInvokeEvent, input: ListTasksByProjectInput) =>
      taskService.listTaskWorkspaces(input.projectId),
    inputSchema: listTasksByProjectInputSchema,
    outputSchema: listTasksByProjectResultSchema
  });

  handleValidatedIpc(taskChannels.create, {
    handler: async (_event: IpcMainInvokeEvent, input: CreateTaskInput) =>
      taskService.createTaskWorkspace(input),
    inputSchema: createTaskInputSchema,
    outputSchema: createTaskResultSchema
  });
}
