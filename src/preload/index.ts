import { contextBridge, ipcRenderer } from 'electron';

import { projectChannels } from '../shared/contracts/projects';
import { taskChannels } from '../shared/contracts/tasks';
import type { AutocodeApi } from '../shared/contracts/electron-api';

const api: AutocodeApi = {
  projects: {
    list: () => ipcRenderer.invoke(projectChannels.list),
    pickPath: () => ipcRenderer.invoke(projectChannels.pickPath),
    add: (input) => ipcRenderer.invoke(projectChannels.add, input)
  },
  tasks: {
    listByProject: (input) => ipcRenderer.invoke(taskChannels.listByProject, input),
    create: (input) => ipcRenderer.invoke(taskChannels.create, input)
  }
};

contextBridge.exposeInMainWorld('autocode', api);
