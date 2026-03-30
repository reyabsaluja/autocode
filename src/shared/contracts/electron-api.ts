import type { AddProjectInput, ListProjectsResult } from './projects';
import type { CreateTaskInput, ListTasksByProjectInput, TaskWorkspaceList } from './tasks';
import type {
  WorkspaceChangesInput,
  WorkspaceChangesResult,
  WorkspaceCommitInput,
  WorkspaceCommitResult,
  WorkspaceDiffInput,
  WorkspaceDiffResult,
  WorkspaceDirectoryInput,
  WorkspaceDirectoryResult
} from './workspaces';
import type {
  WorkspaceFileReadInput,
  WorkspaceFileReadResult,
  WorkspaceFileWriteInput,
  WorkspaceFileWriteResult
} from './workspace-files';
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
  workspaces: {
    listDirectory: (input: WorkspaceDirectoryInput) => Promise<WorkspaceDirectoryResult>;
    listChanges: (input: WorkspaceChangesInput) => Promise<WorkspaceChangesResult>;
    getDiff: (input: WorkspaceDiffInput) => Promise<WorkspaceDiffResult>;
    commitAll: (input: WorkspaceCommitInput) => Promise<WorkspaceCommitResult>;
    readFile: (input: WorkspaceFileReadInput) => Promise<WorkspaceFileReadResult>;
    writeFile: (input: WorkspaceFileWriteInput) => Promise<WorkspaceFileWriteResult>;
  };
}
