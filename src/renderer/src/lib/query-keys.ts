import type { WorkspaceChange } from '@shared/domain/workspace-inspection';

export const queryKeys = {
  agentSessionTranscript: (sessionId: number) => ['agent-sessions', sessionId, 'transcript'] as const,
  agentSessions: (taskId: number) => ['agent-sessions', taskId] as const,
  projects: ['projects'] as const,
  taskWorkspaces: (projectId: number) => ['tasks', projectId] as const,
  workspace: (taskId: number) => ['workspace', taskId] as const,
  workspaceChanges: (taskId: number) => ['workspace', taskId, 'changes'] as const,
  workspaceRecentCommits: (taskId: number) => ['workspace-recent-commits', taskId] as const,
  workspacePublishStatus: (taskId: number) => ['workspace', taskId, 'publish-status'] as const,
  workspaceDiff: (
    taskId: number,
    relativePath: string,
    change: Pick<WorkspaceChange, 'previousPath' | 'status'> | null = null
  ) => ['workspace', taskId, 'diff', relativePath, change?.status ?? null, change?.previousPath ?? null] as const,
  workspaceDirectory: (taskId: number, relativePath: string) =>
    ['workspace', taskId, 'directory', relativePath] as const,
  workspaceBranches: (taskId: number) => ['workspace', taskId, 'branches'] as const,
  workspaceFile: (taskId: number, relativePath: string) =>
    ['workspace', taskId, 'file', relativePath] as const
};
