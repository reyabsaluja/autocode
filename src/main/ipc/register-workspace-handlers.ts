import type { IpcMainInvokeEvent } from 'electron';

import {
  type WorkspaceChangesInput,
  workspaceChangesInputSchema,
  workspaceChangesResultSchema,
  type WorkspaceCommitInput,
  workspaceCommitInputSchema,
  workspaceCommitResultSchema,
  type WorkspaceDiffInput,
  workspaceDiffInputSchema,
  workspaceDiffResultSchema,
  type WorkspaceDirectoryInput,
  workspaceDirectoryInputSchema,
  workspaceDirectoryResultSchema
} from '../../shared/contracts/workspaces';
import {
  type WorkspaceFileReadInput,
  workspaceFileReadResultSchema,
  workspaceFileReadInputSchema,
  type WorkspaceFileWriteInput,
  workspaceFileWriteResultSchema,
  workspaceFileWriteInputSchema
} from '../../shared/contracts/workspace-files';
import { workspaceChannels } from '../../shared/ipc/channels';
import { createWorkspaceFileService } from '../services/workspace-file-service';
import { createWorkspaceService } from '../services/workspace-service';
import { handleValidatedIpc } from './handle-validated-ipc';

export type WorkspaceService = ReturnType<typeof createWorkspaceService>;
export type WorkspaceFileService = ReturnType<typeof createWorkspaceFileService>;

export function registerWorkspaceHandlers(
  workspaceService: WorkspaceService,
  workspaceFileService: WorkspaceFileService
): void {
  handleValidatedIpc(workspaceChannels.listDirectory, {
    handler: async (_event: IpcMainInvokeEvent, input: WorkspaceDirectoryInput) =>
      workspaceService.listDirectory(input),
    inputSchema: workspaceDirectoryInputSchema,
    outputSchema: workspaceDirectoryResultSchema
  });

  handleValidatedIpc(workspaceChannels.listChanges, {
    handler: async (_event: IpcMainInvokeEvent, input: WorkspaceChangesInput) =>
      workspaceService.listChanges(input.taskId),
    inputSchema: workspaceChangesInputSchema,
    outputSchema: workspaceChangesResultSchema
  });

  handleValidatedIpc(workspaceChannels.getDiff, {
    handler: async (_event: IpcMainInvokeEvent, input: WorkspaceDiffInput) =>
      workspaceService.getDiff(input),
    inputSchema: workspaceDiffInputSchema,
    outputSchema: workspaceDiffResultSchema
  });

  handleValidatedIpc(workspaceChannels.commitAll, {
    handler: async (_event: IpcMainInvokeEvent, input: WorkspaceCommitInput) =>
      workspaceService.commitAll(input),
    inputSchema: workspaceCommitInputSchema,
    outputSchema: workspaceCommitResultSchema
  });

  handleValidatedIpc(workspaceChannels.readFile, {
    handler: async (_event: IpcMainInvokeEvent, input: WorkspaceFileReadInput) =>
      workspaceFileService.readFile(input),
    inputSchema: workspaceFileReadInputSchema,
    outputSchema: workspaceFileReadResultSchema
  });

  handleValidatedIpc(workspaceChannels.writeFile, {
    handler: async (_event: IpcMainInvokeEvent, input: WorkspaceFileWriteInput) =>
      workspaceFileService.writeFile(input),
    inputSchema: workspaceFileWriteInputSchema,
    outputSchema: workspaceFileWriteResultSchema
  });
}
