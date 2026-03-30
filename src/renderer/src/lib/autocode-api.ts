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
  projects: {
    list: () => getAutocodeApi().projects.list(),
    pickPath: () => getAutocodeApi().projects.pickPath(),
    add: (input) => getAutocodeApi().projects.add(input)
  },
  tasks: {
    listByProject: (input) => getAutocodeApi().tasks.listByProject(input),
    create: (input) => getAutocodeApi().tasks.create(input)
  },
  workspaces: {
    listDirectory: (input) => getAutocodeApi().workspaces.listDirectory(input),
    listChanges: (input) => getAutocodeApi().workspaces.listChanges(input),
    getDiff: (input) => getAutocodeApi().workspaces.getDiff(input),
    commitAll: (input) => getAutocodeApi().workspaces.commitAll(input)
  }
};
