import { contextBridge } from 'electron';

import type { AutocodeApi } from '../shared/contracts/electron-api';
import {
  deleteAgentSessionInputSchema,
  deleteAgentSessionResultSchema,
  agentSessionEventResultSchema,
  listAgentSessionsByTaskInputSchema,
  listAgentSessionsByTaskResultSchema,
  permissionRequestResultSchema,
  permissionResponseInputSchema,
  permissionResponseResultSchema,
  readAgentSessionTranscriptTailInputSchema,
  readAgentSessionTranscriptTailResultSchema,
  renameAgentSessionInputSchema,
  renameAgentSessionResultSchema,
  resizeAgentSessionInputSchema,
  resizeAgentSessionResultSchema,
  sendAgentSessionInputSchema,
  sendAgentSessionResultSchema,
  setSystemPromptInputSchema,
  setSystemPromptResultSchema,
  startAgentSessionInputSchema,
  startAgentSessionResultSchema,
  stopAgentSessionInputSchema,
  stopAgentSessionResultSchema
} from '../shared/contracts/agent-sessions';
import {
  addProjectInputSchema,
  addProjectResultSchema,
  deleteProjectInputSchema,
  deleteProjectResultSchema,
  listProjectsResultSchema,
  pickProjectPathResultSchema
} from '../shared/contracts/projects';
import {
  createTaskInputSchema,
  createTaskResultSchema,
  deleteTaskInputSchema,
  deleteTaskResultSchema,
  listTasksByProjectInputSchema,
  listTasksByProjectResultSchema
} from '../shared/contracts/tasks';
import {
  workspaceChangesInputSchema,
  workspaceInspectionEventResultSchema,
  workspaceChangesResultSchema,
  workspaceCommitInputSchema,
  workspaceCommitResultSchema,
  workspaceCreatePullRequestInputSchema,
  workspaceCreatePullRequestResultSchema,
  workspaceDiffInputSchema,
  workspaceDiffResultSchema,
  workspaceDirectoryInputSchema,
  workspaceDirectoryResultSchema,
  workspaceIntegrateBaseInputSchema,
  workspaceIntegrationResultSchema,
  workspaceListBranchesInputSchema,
  workspaceListBranchesResultSchema,
  workspaceMergeTaskInputSchema,
  workspaceOpenInEditorInputSchema,
  workspaceOpenInEditorResultSchema,
  workspaceUpdateBaseRefInputSchema,
  workspaceUpdateBaseRefResultSchema,
  workspaceOpenPullRequestInputSchema,
  workspaceOpenPullRequestResultSchema,
  workspacePublishStatusInputSchema,
  workspacePublishStatusResultSchema,
  workspacePushInputSchema,
  workspacePushResultSchema,
  workspaceRecentCommitsInputSchema,
  workspaceRecentCommitsResultSchema
} from '../shared/contracts/workspaces';
import {
  workspaceFileReadInputSchema,
  workspaceFileReadResultSchema,
  workspaceFileWriteInputSchema,
  workspaceFileWriteResultSchema
} from '../shared/contracts/workspace-files';
import {
  agentSessionChannels,
  projectChannels,
  taskChannels,
  workspaceChannels
} from '../shared/ipc/channels';
import { invokeValidatedIpc } from './invoke-validated-ipc';
import { subscribeValidatedIpc } from './subscribe-validated-ipc';

const api: AutocodeApi = {
  agentSessions: {
    delete: (input) =>
      invokeValidatedIpc(agentSessionChannels.delete, {
        input,
        inputSchema: deleteAgentSessionInputSchema,
        outputSchema: deleteAgentSessionResultSchema
      }),
    listByTask: (input) =>
      invokeValidatedIpc(agentSessionChannels.listByTask, {
        input,
        inputSchema: listAgentSessionsByTaskInputSchema,
        outputSchema: listAgentSessionsByTaskResultSchema
      }),
    readTranscriptTail: (input) =>
      invokeValidatedIpc(agentSessionChannels.readTranscriptTail, {
        input,
        inputSchema: readAgentSessionTranscriptTailInputSchema,
        outputSchema: readAgentSessionTranscriptTailResultSchema
      }),
    rename: (input) =>
      invokeValidatedIpc(agentSessionChannels.rename, {
        input,
        inputSchema: renameAgentSessionInputSchema,
        outputSchema: renameAgentSessionResultSchema
      }),
    resize: (input) =>
      invokeValidatedIpc(agentSessionChannels.resize, {
        input,
        inputSchema: resizeAgentSessionInputSchema,
        outputSchema: resizeAgentSessionResultSchema
      }),
    respondToPermission: (input) =>
      invokeValidatedIpc(agentSessionChannels.permissionResponse, {
        input,
        inputSchema: permissionResponseInputSchema,
        outputSchema: permissionResponseResultSchema
      }),
    sendInput: (input) =>
      invokeValidatedIpc(agentSessionChannels.sendInput, {
        input,
        inputSchema: sendAgentSessionInputSchema,
        outputSchema: sendAgentSessionResultSchema
      }),
    setSystemPrompt: (input) =>
      invokeValidatedIpc(agentSessionChannels.setSystemPrompt, {
        input,
        inputSchema: setSystemPromptInputSchema,
        outputSchema: setSystemPromptResultSchema
      }),
    start: (input) =>
      invokeValidatedIpc(agentSessionChannels.start, {
        input,
        inputSchema: startAgentSessionInputSchema,
        outputSchema: startAgentSessionResultSchema
      }),
    stop: (input) =>
      invokeValidatedIpc(agentSessionChannels.stop, {
        input,
        inputSchema: stopAgentSessionInputSchema,
        outputSchema: stopAgentSessionResultSchema
      }),
    subscribe: (taskId, callback) =>
      subscribeValidatedIpc(
        agentSessionChannels.event,
        agentSessionEventResultSchema,
        (event) => {
          const eventTaskId = event.type === 'snapshot' ? event.session.taskId : event.taskId;

          if (eventTaskId !== taskId) {
            return;
          }

          callback(event);
        }
      ),
    subscribePermissionRequests: (callback) =>
      subscribeValidatedIpc(
        agentSessionChannels.permissionRequest,
        permissionRequestResultSchema,
        callback
      )
  },
  projects: {
    list: () =>
      invokeValidatedIpc(projectChannels.list, {
        outputSchema: listProjectsResultSchema
      }),
    pickPath: () =>
      invokeValidatedIpc(projectChannels.pickPath, {
        outputSchema: pickProjectPathResultSchema
      }),
    add: (input) =>
      invokeValidatedIpc(projectChannels.add, {
        input,
        inputSchema: addProjectInputSchema,
        outputSchema: addProjectResultSchema
      }),
    delete: (input) =>
      invokeValidatedIpc(projectChannels.delete, {
        input,
        inputSchema: deleteProjectInputSchema,
        outputSchema: deleteProjectResultSchema
      })
  },
  tasks: {
    listByProject: (input) =>
      invokeValidatedIpc(taskChannels.listByProject, {
        input,
        inputSchema: listTasksByProjectInputSchema,
        outputSchema: listTasksByProjectResultSchema
      }),
    create: (input) =>
      invokeValidatedIpc(taskChannels.create, {
        input,
        inputSchema: createTaskInputSchema,
        outputSchema: createTaskResultSchema
      }),
    delete: (input) =>
      invokeValidatedIpc(taskChannels.delete, {
        input,
        inputSchema: deleteTaskInputSchema,
        outputSchema: deleteTaskResultSchema
      })
  },
  workspaces: {
    listDirectory: (input) =>
      invokeValidatedIpc(workspaceChannels.listDirectory, {
        input,
        inputSchema: workspaceDirectoryInputSchema,
        outputSchema: workspaceDirectoryResultSchema
      }),
    listChanges: (input) =>
      invokeValidatedIpc(workspaceChannels.listChanges, {
        input,
        inputSchema: workspaceChangesInputSchema,
        outputSchema: workspaceChangesResultSchema
      }),
    listRecentCommits: (input) =>
      invokeValidatedIpc(workspaceChannels.listRecentCommits, {
        input,
        inputSchema: workspaceRecentCommitsInputSchema,
        outputSchema: workspaceRecentCommitsResultSchema
      }),
    getDiff: (input) =>
      invokeValidatedIpc(workspaceChannels.getDiff, {
        input,
        inputSchema: workspaceDiffInputSchema,
        outputSchema: workspaceDiffResultSchema
      }),
    getPublishStatus: (input) =>
      invokeValidatedIpc(workspaceChannels.getPublishStatus, {
        input,
        inputSchema: workspacePublishStatusInputSchema,
        outputSchema: workspacePublishStatusResultSchema
      }),
    commitAll: (input) =>
      invokeValidatedIpc(workspaceChannels.commitAll, {
        input,
        inputSchema: workspaceCommitInputSchema,
        outputSchema: workspaceCommitResultSchema
      }),
    pushBranch: (input) =>
      invokeValidatedIpc(workspaceChannels.pushBranch, {
        input,
        inputSchema: workspacePushInputSchema,
        outputSchema: workspacePushResultSchema
      }),
    createPullRequest: (input) =>
      invokeValidatedIpc(workspaceChannels.createPullRequest, {
        input,
        inputSchema: workspaceCreatePullRequestInputSchema,
        outputSchema: workspaceCreatePullRequestResultSchema
      }),
    integrateBase: (input) =>
      invokeValidatedIpc(workspaceChannels.integrateBase, {
        input,
        inputSchema: workspaceIntegrateBaseInputSchema,
        outputSchema: workspaceIntegrationResultSchema
      }),
    listBranches: (input) =>
      invokeValidatedIpc(workspaceChannels.listBranches, {
        input,
        inputSchema: workspaceListBranchesInputSchema,
        outputSchema: workspaceListBranchesResultSchema
      }),
    mergeTask: (input) =>
      invokeValidatedIpc(workspaceChannels.mergeTask, {
        input,
        inputSchema: workspaceMergeTaskInputSchema,
        outputSchema: workspaceIntegrationResultSchema
      }),
    openInEditor: (input) =>
      invokeValidatedIpc(workspaceChannels.openInEditor, {
        input,
        inputSchema: workspaceOpenInEditorInputSchema,
        outputSchema: workspaceOpenInEditorResultSchema
      }),
    openPullRequest: (input) =>
      invokeValidatedIpc(workspaceChannels.openPullRequest, {
        input,
        inputSchema: workspaceOpenPullRequestInputSchema,
        outputSchema: workspaceOpenPullRequestResultSchema
      }),
    readFile: (input) =>
      invokeValidatedIpc(workspaceChannels.readFile, {
        input,
        inputSchema: workspaceFileReadInputSchema,
        outputSchema: workspaceFileReadResultSchema
      }),
    updateBaseRef: (input) =>
      invokeValidatedIpc(workspaceChannels.updateBaseRef, {
        input,
        inputSchema: workspaceUpdateBaseRefInputSchema,
        outputSchema: workspaceUpdateBaseRefResultSchema
      }),
    writeFile: (input) =>
      invokeValidatedIpc(workspaceChannels.writeFile, {
        input,
        inputSchema: workspaceFileWriteInputSchema,
        outputSchema: workspaceFileWriteResultSchema
      }),
    subscribeInspection: (taskId, callback) =>
      subscribeValidatedIpc(
        workspaceChannels.event,
        workspaceInspectionEventResultSchema,
        (event) => {
          if (event.taskId !== taskId) {
            return;
          }

          callback(event);
        }
      )
  }
};

contextBridge.exposeInMainWorld('autocode', api);
