import { useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { WorkspaceCommitInput, WorkspaceDirectoryInput, WorkspaceDiffInput } from '@shared/contracts/workspaces';

import { autocodeApi } from '../../lib/autocode-api';
import { queryKeys } from '../../lib/query-keys';

const WORKSPACE_EXPLORER_DIRECTORY_STALE_TIME_MS = 60_000;
const WORKSPACE_EXPLORER_DIRECTORY_GC_TIME_MS = 10 * 60_000;

export function useWorkspaceExplorerDirectoryQuery(
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
    // Explorer structure can stay cached until the workspace is explicitly refreshed or invalidated.
    gcTime: WORKSPACE_EXPLORER_DIRECTORY_GC_TIME_MS,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: WORKSPACE_EXPLORER_DIRECTORY_STALE_TIME_MS
  });
}

export function useWorkspaceChangesQuery(taskId: number | null) {
  const queryClient = useQueryClient();
  const lastSyncedHealthAtRef = useRef(0);
  const query = useQuery({
    enabled: taskId !== null,
    queryKey: taskId !== null ? queryKeys.workspaceChanges(taskId) : ['workspace', 'idle', 'changes'],
    queryFn: () => autocodeApi.workspaces.listChanges({ taskId: taskId! }),
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    staleTime: 0
  });

  const settledAt = Math.max(query.dataUpdatedAt, query.errorUpdatedAt);

  useEffect(() => {
    if (taskId === null || settledAt === 0 || settledAt === lastSyncedHealthAtRef.current) {
      return;
    }

    lastSyncedHealthAtRef.current = settledAt;
    // listChanges is the workspace-health observation path in main, so task/project
    // collections need a follow-up refresh after it settles to stay consistent.
    void invalidateWorkspaceCollections(queryClient);
  }, [queryClient, settledAt, taskId]);

  return query;
}

export function useWorkspaceDiffQuery(
  taskId: number | null,
  relativePath: string | null,
  enabled = true
) {
  return useQuery({
    enabled: taskId !== null && relativePath !== null && enabled,
    queryKey:
      taskId !== null && relativePath !== null
        ? queryKeys.workspaceDiff(taskId, relativePath)
        : ['workspace', 'idle', 'diff'],
    queryFn: () =>
      autocodeApi.workspaces.getDiff({
        relativePath: relativePath!,
        taskId: taskId!
      } satisfies WorkspaceDiffInput),
    refetchOnMount: 'always',
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
    onSettled: async () => {
      if (taskId !== null) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.workspace(taskId) });
      }
    }
  });
}

async function invalidateWorkspaceCollections(queryClient: ReturnType<typeof useQueryClient>) {
  await queryClient.invalidateQueries({ queryKey: ['tasks'] });
  await queryClient.invalidateQueries({ queryKey: queryKeys.projects });
}
