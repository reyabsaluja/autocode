import { contextBridge, ipcRenderer } from 'electron';

import type { AutocodeApi } from '../shared/contracts/electron-api';
import { projectChannels, taskChannels, workspaceChannels } from '../shared/ipc/channels';

const api: AutocodeApi = {
  projects: {
    list: () => ipcRenderer.invoke(projectChannels.list),
    pickPath: () => ipcRenderer.invoke(projectChannels.pickPath),
    add: (input) => ipcRenderer.invoke(projectChannels.add, input)
  },
  tasks: {
    listByProject: (input) => ipcRenderer.invoke(taskChannels.listByProject, input),
    create: (input) => ipcRenderer.invoke(taskChannels.create, input)
  },
  workspaces: {
    listDirectory: (input) => ipcRenderer.invoke(workspaceChannels.listDirectory, input),
    listChanges: (input) => ipcRenderer.invoke(workspaceChannels.listChanges, input),
    getDiff: (input) => ipcRenderer.invoke(workspaceChannels.getDiff, input),
    commitAll: (input) => ipcRenderer.invoke(workspaceChannels.commitAll, input)
  }
};

contextBridge.exposeInMainWorld('autocode', api);
