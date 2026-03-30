import { ipcMain } from 'electron';

import { createTaskInputSchema, listTasksByProjectInputSchema } from '../../shared/contracts/tasks';
import { taskChannels } from '../../shared/ipc/channels';
import { createTaskService } from '../services/task-service';

export type TaskService = ReturnType<typeof createTaskService>;

export function registerTaskHandlers(taskService: TaskService): void {
  ipcMain.handle(taskChannels.listByProject, (_event, rawInput) => {
    const input = listTasksByProjectInputSchema.parse(rawInput);
    return taskService.listTaskWorkspaces(input.projectId);
  });

  ipcMain.handle(taskChannels.create, async (_event, rawInput) => {
    const input = createTaskInputSchema.parse(rawInput);
    return taskService.createTaskWorkspace(input);
  });
}
