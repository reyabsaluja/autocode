import { ipcMain } from 'electron';

import {
  workspaceChangesInputSchema,
  workspaceCommitInputSchema,
  workspaceDiffInputSchema,
  workspaceDirectoryInputSchema
} from '../../shared/contracts/workspaces';
import { workspaceChannels } from '../../shared/ipc/channels';
import { createWorkspaceService } from '../services/workspace-service';

export type WorkspaceService = ReturnType<typeof createWorkspaceService>;

export function registerWorkspaceHandlers(workspaceService: WorkspaceService): void {
  ipcMain.handle(workspaceChannels.listDirectory, async (_event, rawInput) => {
    const input = workspaceDirectoryInputSchema.parse(rawInput);
    return workspaceService.listDirectory(input);
  });

  ipcMain.handle(workspaceChannels.listChanges, async (_event, rawInput) => {
    const input = workspaceChangesInputSchema.parse(rawInput);
    return workspaceService.listChanges(input.taskId);
  });

  ipcMain.handle(workspaceChannels.getDiff, async (_event, rawInput) => {
    const input = workspaceDiffInputSchema.parse(rawInput);
    return workspaceService.getDiff(input);
  });

  ipcMain.handle(workspaceChannels.commitAll, async (_event, rawInput) => {
    const input = workspaceCommitInputSchema.parse(rawInput);
    return workspaceService.commitAll(input);
  });
}
