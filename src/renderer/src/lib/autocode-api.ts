import type { AutocodeApi } from '@shared/contracts/electron-api';

let apiOverride: AutocodeApi | null = null;

export function getAutocodeApi(): AutocodeApi {
  if (apiOverride) {
    return apiOverride;
  }

  if (!window.autocode) {
    throw new Error('Autocode preload API is not available.');
  }

  return window.autocode;
}

export function setAutocodeApiForTesting(api: AutocodeApi | null): void {
  apiOverride = api;
}

export const autocodeApi: AutocodeApi = {
  agentSessions: {
    delete: (input) => getAutocodeApi().agentSessions.delete(input),
    listByTask: (input) => getAutocodeApi().agentSessions.listByTask(input),
    readTranscriptTail: (input) => getAutocodeApi().agentSessions.readTranscriptTail(input),
    resize: (input) => getAutocodeApi().agentSessions.resize(input),
    sendInput: (input) => getAutocodeApi().agentSessions.sendInput(input),
    start: (input) => getAutocodeApi().agentSessions.start(input),
    subscribe: (taskId, callback) => getAutocodeApi().agentSessions.subscribe(taskId, callback),
    terminate: (input) => getAutocodeApi().agentSessions.terminate(input)
  },
  projects: {
    list: () => getAutocodeApi().projects.list(),
    pickPath: () => getAutocodeApi().projects.pickPath(),
    add: (input) => getAutocodeApi().projects.add(input)
  },
  tasks: {
    listByProject: (input) => getAutocodeApi().tasks.listByProject(input),
    create: (input) => getAutocodeApi().tasks.create(input),
    delete: (input) => getAutocodeApi().tasks.delete(input)
  },
  workspaces: {
    listDirectory: (input) => getAutocodeApi().workspaces.listDirectory(input),
    listChanges: (input) => getAutocodeApi().workspaces.listChanges(input),
    listRecentCommits: (input) => getAutocodeApi().workspaces.listRecentCommits(input),
    getDiff: (input) => getAutocodeApi().workspaces.getDiff(input),
    commitAll: (input) => getAutocodeApi().workspaces.commitAll(input),
    readFile: (input) => getAutocodeApi().workspaces.readFile(input),
    subscribeInspection: (taskId, callback) =>
      getAutocodeApi().workspaces.subscribeInspection(taskId, callback),
    writeFile: (input) => getAutocodeApi().workspaces.writeFile(input)
  }
};
