import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { WorkspaceCommitInput, WorkspaceDirectoryInput, WorkspaceDiffInput } from '@shared/contracts/workspaces';

import { autocodeApi } from '../../lib/autocode-api';
import { queryKeys } from '../../lib/query-keys';

export function useWorkspaceDirectoryQuery(
  taskId: number | null,
  relativePath: string,
  enabled = true
) {
  return useQuery({
    enabled: taskId !== null && enabled,
    queryKey: taskId !== null ? queryKeys.workspaceDirectory(taskId, relativePath) : ['workspace', 'idle', 'directory', relativePath],
    queryFn: () =>
      autocodeApi.workspaces.listDirectory({
        relativePath,
        taskId: taskId!
      } satisfies WorkspaceDirectoryInput),
    refetchOnWindowFocus: true,
    staleTime: 0
  });
}

export function useWorkspaceChangesQuery(taskId: number | null) {
  return useQuery({
    enabled: taskId !== null,
    queryKey: taskId !== null ? queryKeys.workspaceChanges(taskId) : ['workspace', 'idle', 'changes'],
    queryFn: () => autocodeApi.workspaces.listChanges({ taskId: taskId! }),
    refetchOnWindowFocus: true,
    staleTime: 0
  });
}

export function useWorkspaceDiffQuery(taskId: number | null, relativePath: string | null) {
  return useQuery({
    enabled: taskId !== null && relativePath !== null,
    queryKey:
      taskId !== null && relativePath !== null
        ? queryKeys.workspaceDiff(taskId, relativePath)
        : ['workspace', 'idle', 'diff'],
    queryFn: () =>
      autocodeApi.workspaces.getDiff({
        relativePath: relativePath!,
        taskId: taskId!
      } satisfies WorkspaceDiffInput),
    refetchOnWindowFocus: true,
    staleTime: 0
  });
}

export function useCommitWorkspaceMutation(taskId: number | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: Omit<WorkspaceCommitInput, 'taskId'>) => {
      if (taskId === null) {
        throw new Error('Select a task workspace before committing changes.');
      }

      return autocodeApi.workspaces.commitAll({
        ...input,
        taskId
      });
    },
    onSuccess: async () => {
      if (taskId !== null) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.workspace(taskId) });
      }

      await queryClient.invalidateQueries({ queryKey: ['tasks'] });
      await queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    }
  });
}
