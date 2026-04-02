import type { IpcMainInvokeEvent } from 'electron';

import {
  type WorkspaceChangesInput,
  workspaceChangesInputSchema,
  workspaceChangesResultSchema,
  type WorkspaceCommitInput,
  workspaceCommitInputSchema,
  workspaceCommitResultSchema,
  type WorkspaceCreatePullRequestInput,
  workspaceCreatePullRequestInputSchema,
  workspaceCreatePullRequestResultSchema,
  type WorkspaceDiffInput,
  workspaceDiffInputSchema,
  workspaceDiffResultSchema,
  type WorkspaceDirectoryInput,
  workspaceDirectoryInputSchema,
  workspaceDirectoryResultSchema,
  type WorkspaceIntegrateBaseInput,
  workspaceIntegrateBaseInputSchema,
  workspaceIntegrationResultSchema,
  type WorkspaceMergeTaskInput,
  workspaceMergeTaskInputSchema,
  type WorkspaceOpenPullRequestInput,
  workspaceOpenPullRequestInputSchema,
  workspaceOpenPullRequestResultSchema,
  type WorkspacePublishStatusInput,
  workspacePublishStatusInputSchema,
  workspacePublishStatusResultSchema,
  type WorkspacePushInput,
  workspacePushInputSchema,
  workspacePushResultSchema,
  type WorkspaceRecentCommitsInput,
  workspaceRecentCommitsInputSchema,
  workspaceRecentCommitsResultSchema
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

  handleValidatedIpc(workspaceChannels.listRecentCommits, {
    handler: async (_event: IpcMainInvokeEvent, input: WorkspaceRecentCommitsInput) =>
      workspaceService.listRecentCommits(input.taskId),
    inputSchema: workspaceRecentCommitsInputSchema,
    outputSchema: workspaceRecentCommitsResultSchema
  });

  handleValidatedIpc(workspaceChannels.getDiff, {
    handler: async (_event: IpcMainInvokeEvent, input: WorkspaceDiffInput) =>
      workspaceService.getDiff(input),
    inputSchema: workspaceDiffInputSchema,
    outputSchema: workspaceDiffResultSchema
  });

  handleValidatedIpc(workspaceChannels.getPublishStatus, {
    handler: async (_event: IpcMainInvokeEvent, input: WorkspacePublishStatusInput) =>
      workspaceService.getPublishStatus(input),
    inputSchema: workspacePublishStatusInputSchema,
    outputSchema: workspacePublishStatusResultSchema
  });

  handleValidatedIpc(workspaceChannels.commitAll, {
    handler: async (_event: IpcMainInvokeEvent, input: WorkspaceCommitInput) =>
      workspaceService.commitAll(input),
    inputSchema: workspaceCommitInputSchema,
    outputSchema: workspaceCommitResultSchema
  });

  handleValidatedIpc(workspaceChannels.pushBranch, {
    handler: async (_event: IpcMainInvokeEvent, input: WorkspacePushInput) =>
      workspaceService.pushBranch(input),
    inputSchema: workspacePushInputSchema,
    outputSchema: workspacePushResultSchema
  });

  handleValidatedIpc(workspaceChannels.createPullRequest, {
    handler: async (_event: IpcMainInvokeEvent, input: WorkspaceCreatePullRequestInput) =>
      workspaceService.createPullRequest(input),
    inputSchema: workspaceCreatePullRequestInputSchema,
    outputSchema: workspaceCreatePullRequestResultSchema
  });

  handleValidatedIpc(workspaceChannels.integrateBase, {
    handler: async (_event: IpcMainInvokeEvent, input: WorkspaceIntegrateBaseInput) =>
      workspaceService.integrateBase(input),
    inputSchema: workspaceIntegrateBaseInputSchema,
    outputSchema: workspaceIntegrationResultSchema
  });

  handleValidatedIpc(workspaceChannels.mergeTask, {
    handler: async (_event: IpcMainInvokeEvent, input: WorkspaceMergeTaskInput) =>
      workspaceService.mergeTask(input),
    inputSchema: workspaceMergeTaskInputSchema,
    outputSchema: workspaceIntegrationResultSchema
  });

  handleValidatedIpc(workspaceChannels.openPullRequest, {
    handler: async (_event: IpcMainInvokeEvent, input: WorkspaceOpenPullRequestInput) =>
      workspaceService.openPullRequest(input),
    inputSchema: workspaceOpenPullRequestInputSchema,
    outputSchema: workspaceOpenPullRequestResultSchema
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
