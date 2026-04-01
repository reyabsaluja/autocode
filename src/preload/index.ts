import { contextBridge } from 'electron';

import type { AutocodeApi } from '../shared/contracts/electron-api';
import {
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
  listTasksByProjectInputSchema,
  listTasksByProjectResultSchema
} from '../shared/contracts/tasks';
import {
  workspaceChangesInputSchema,
  workspaceChangesResultSchema,
  workspaceCommitInputSchema,
  workspaceCommitResultSchema,
  workspaceDiffInputSchema,
  workspaceDiffResultSchema,
  workspaceDirectoryInputSchema,
  workspaceDirectoryResultSchema
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
    subscribe: (sessionId, callback) =>
      subscribeValidatedIpc(
        agentSessionChannels.event,
        agentSessionEventResultSchema,
        (event) => {
          if (event.type === 'snapshot' && event.session.id !== sessionId) {
            return;
          }

          if (event.type === 'entries' && event.sessionId !== sessionId) {
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
    getDiff: (input) =>
      invokeValidatedIpc(workspaceChannels.getDiff, {
        input,
        inputSchema: workspaceDiffInputSchema,
        outputSchema: workspaceDiffResultSchema
      }),
    commitAll: (input) =>
      invokeValidatedIpc(workspaceChannels.commitAll, {
        input,
        inputSchema: workspaceCommitInputSchema,
        outputSchema: workspaceCommitResultSchema
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
      })
  }
};

contextBridge.exposeInMainWorld('autocode', api);
