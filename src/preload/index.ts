import { contextBridge, ipcRenderer } from 'electron';

import { projectChannels } from '../shared/contracts/projects';
import type { AutocodeApi } from '../shared/contracts/electron-api';

const api: AutocodeApi = {
  projects: {
    list: () => ipcRenderer.invoke(projectChannels.list),
    pickPath: () => ipcRenderer.invoke(projectChannels.pickPath),
    add: (input) => ipcRenderer.invoke(projectChannels.add, input)
  }
};

contextBridge.exposeInMainWorld('autocode', api);
