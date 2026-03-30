import { ipcMain } from 'electron';

import {
  workspaceChangesInputSchema,
  workspaceCommitInputSchema,
  workspaceDiffInputSchema,
  workspaceDirectoryInputSchema
} from '../../shared/contracts/workspaces';
import {
  workspaceFileReadInputSchema,
  workspaceFileWriteInputSchema
} from '../../shared/contracts/workspace-files';
import { workspaceChannels } from '../../shared/ipc/channels';
import { createWorkspaceFileService } from '../services/workspace-file-service';
import { createWorkspaceService } from '../services/workspace-service';

export type WorkspaceService = ReturnType<typeof createWorkspaceService>;
export type WorkspaceFileService = ReturnType<typeof createWorkspaceFileService>;

export function registerWorkspaceHandlers(
  workspaceService: WorkspaceService,
  workspaceFileService: WorkspaceFileService
): void {
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

  ipcMain.handle(workspaceChannels.readFile, async (_event, rawInput) => {
    const input = workspaceFileReadInputSchema.parse(rawInput);
    return workspaceFileService.readFile(input);
  });

  ipcMain.handle(workspaceChannels.writeFile, async (_event, rawInput) => {
    const input = workspaceFileWriteInputSchema.parse(rawInput);
    return workspaceFileService.writeFile(input);
  });
}
