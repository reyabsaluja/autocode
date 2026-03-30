import type { AddProjectInput, ListProjectsResult } from './projects';
import type { Project } from '../domain/project';

export interface AutocodeApi {
  projects: {
    list: () => Promise<ListProjectsResult>;
    pickPath: () => Promise<string | null>;
    add: (input: AddProjectInput) => Promise<Project>;
  };
}

