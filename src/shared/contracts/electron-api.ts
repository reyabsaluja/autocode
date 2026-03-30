import type { AddProjectInput, ListProjectsResult } from './projects';
import type { CreateTaskInput, ListTasksByProjectInput, TaskWorkspaceList } from './tasks';
import type { Project } from '../domain/project';
import type { TaskWorkspace } from '../domain/task-workspace';

export interface AutocodeApi {
  projects: {
    list: () => Promise<ListProjectsResult>;
    pickPath: () => Promise<string | null>;
    add: (input: AddProjectInput) => Promise<Project>;
  };
  tasks: {
    listByProject: (input: ListTasksByProjectInput) => Promise<TaskWorkspaceList>;
    create: (input: CreateTaskInput) => Promise<TaskWorkspace>;
  };
}
