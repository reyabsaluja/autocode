import type { WorkspaceChange } from '@shared/domain/workspace-inspection';

export const queryKeys = {
  projects: ['projects'] as const,
  taskWorkspaces: (projectId: number) => ['tasks', projectId] as const,
  workspace: (taskId: number) => ['workspace', taskId] as const,
  workspaceChanges: (taskId: number) => ['workspace', taskId, 'changes'] as const,
  workspaceDiff: (
    taskId: number,
    relativePath: string,
    change: Pick<WorkspaceChange, 'previousPath' | 'status'> | null = null
  ) => ['workspace', taskId, 'diff', relativePath, change?.status ?? null, change?.previousPath ?? null] as const,
  workspaceDirectory: (taskId: number, relativePath: string) =>
    ['workspace', taskId, 'directory', relativePath] as const,
  workspaceFile: (taskId: number, relativePath: string) =>
    ['workspace', taskId, 'file', relativePath] as const
};
