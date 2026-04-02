import { contextBridge } from 'electron';

import type { AutocodeApi } from '../shared/contracts/electron-api';
import {
  deleteAgentSessionInputSchema,
  deleteAgentSessionResultSchema,
  agentSessionEventResultSchema,
  listAgentSessionsByTaskInputSchema,
  listAgentSessionsByTaskResultSchema,
  readAgentSessionTranscriptTailInputSchema,
  readAgentSessionTranscriptTailResultSchema,
  resizeAgentSessionInputSchema,
  resizeAgentSessionResultSchema,
  sendAgentSessionInputSchema,
  sendAgentSessionResultSchema,
  startAgentSessionInputSchema,
  startAgentSessionResultSchema,
  terminateAgentSessionInputSchema,
  terminateAgentSessionResultSchema
} from '../shared/contracts/agent-sessions';
import {
  addProjectInputSchema,
  addProjectResultSchema,
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
  workspaceMergeTaskInputSchema,
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
    resize: (input) =>
      invokeValidatedIpc(agentSessionChannels.resize, {
        input,
        inputSchema: resizeAgentSessionInputSchema,
        outputSchema: resizeAgentSessionResultSchema
      }),
    sendInput: (input) =>
      invokeValidatedIpc(agentSessionChannels.sendInput, {
        input,
        inputSchema: sendAgentSessionInputSchema,
        outputSchema: sendAgentSessionResultSchema
      }),
    start: (input) =>
      invokeValidatedIpc(agentSessionChannels.start, {
        input,
        inputSchema: startAgentSessionInputSchema,
        outputSchema: startAgentSessionResultSchema
      }),
    subscribe: (taskId, callback) =>
      subscribeValidatedIpc(
        agentSessionChannels.event,
        agentSessionEventResultSchema,
        (event) => {
          if (event.type === 'snapshot' && event.session.taskId !== taskId) {
            return;
          }

          callback(event);
        }
      ),
    terminate: (input) =>
      invokeValidatedIpc(agentSessionChannels.terminate, {
        input,
        inputSchema: terminateAgentSessionInputSchema,
        outputSchema: terminateAgentSessionResultSchema
      })
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
    mergeTask: (input) =>
      invokeValidatedIpc(workspaceChannels.mergeTask, {
        input,
        inputSchema: workspaceMergeTaskInputSchema,
        outputSchema: workspaceIntegrationResultSchema
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
