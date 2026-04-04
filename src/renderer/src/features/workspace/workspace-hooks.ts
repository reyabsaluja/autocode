import { useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  WorkspaceCollectionSync,
  WorkspaceCommitInput,
  WorkspaceCreatePullRequestInput,
  WorkspaceDirectoryInput,
  WorkspaceDiffInput,
  WorkspaceIntegrateBaseInput,
  WorkspaceOpenPullRequestInput,
  WorkspacePublishStatusInput,
  WorkspacePushInput,
  WorkspaceRecentCommitsInput,
  WorkspaceMergeTaskInput
} from '@shared/contracts/workspaces';
import type { Project } from '@shared/domain/project';
import type { WorkspaceChange } from '@shared/domain/workspace-inspection';
import type { TaskWorkspace } from '@shared/domain/task-workspace';

import { autocodeApi } from '../../lib/autocode-api';
import { queryKeys } from '../../lib/query-keys';
import {
  invalidateTaskWorkspaceCollectionsForTask,
  upsertProject,
  upsertTaskWorkspace
} from '../../lib/task-workspace-cache';

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
  const lastHandledDataAtRef = useRef(0);
  const lastHandledErrorAtRef = useRef(0);
  const query = useQuery({
    enabled: taskId !== null,
    queryKey: taskId !== null ? queryKeys.workspaceChanges(taskId) : ['workspace', 'idle', 'changes'],
    queryFn: () => autocodeApi.workspaces.listChanges({ taskId: taskId! }),
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
    staleTime: Infinity
  });

  useEffect(() => {
    if (taskId === null || query.dataUpdatedAt === 0 || query.dataUpdatedAt === lastHandledDataAtRef.current) {
      return;
    }

    lastHandledDataAtRef.current = query.dataUpdatedAt;

    if (!query.data?.observation.didHealthChange) {
      return;
    }

    syncWorkspaceCollections(queryClient, query.data.observation);
  }, [query.data, query.dataUpdatedAt, queryClient, taskId]);

  useEffect(() => {
    if (taskId === null || query.errorUpdatedAt === 0 || query.errorUpdatedAt === lastHandledErrorAtRef.current) {
      return;
    }

    lastHandledErrorAtRef.current = query.errorUpdatedAt;
    void invalidateWorkspaceCollectionsForTask(queryClient, taskId);
  }, [query.errorUpdatedAt, queryClient, taskId]);

  return query;
}

export function useWorkspaceDiffQuery(
  taskId: number | null,
  relativePath: string | null,
  activeChange: WorkspaceChange | null,
  enabled = true
) {
  return useQuery({
    enabled: taskId !== null && relativePath !== null && enabled,
    queryKey:
      taskId !== null && relativePath !== null
        ? queryKeys.workspaceDiff(taskId, relativePath, activeChange)
        : ['workspace', 'idle', 'diff'],
    queryFn: () =>
      autocodeApi.workspaces.getDiff({
        previousPath: activeChange?.previousPath,
        relativePath: relativePath!,
        status: activeChange?.status,
        taskId: taskId!
      } satisfies WorkspaceDiffInput),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: Infinity
  });
}

export function useWorkspaceRecentCommitsQuery(taskId: number | null, enabled = true) {
  return useQuery({
    enabled: taskId !== null && enabled,
    queryKey: taskId !== null ? queryKeys.workspaceRecentCommits(taskId) : ['workspace-recent-commits', 'idle'],
    queryFn: () =>
      autocodeApi.workspaces.listRecentCommits({
        taskId: taskId!
      } satisfies WorkspaceRecentCommitsInput),
    gcTime: WORKSPACE_EXPLORER_DIRECTORY_GC_TIME_MS,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: 30_000
  });
}

export function useWorkspacePublishStatusQuery(taskId: number | null, enabled = true) {
  return useQuery({
    enabled: taskId !== null && enabled,
    queryKey:
      taskId !== null
        ? queryKeys.workspacePublishStatus(taskId)
        : ['workspace', 'idle', 'publish-status'],
    queryFn: () =>
      autocodeApi.workspaces.getPublishStatus({
        taskId: taskId!
      } satisfies WorkspacePublishStatusInput),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: Infinity
  });
}

export function useWorkspaceInspectionStream(taskId: number | null, enabled = true) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (taskId === null || !enabled) {
      return;
    }

    return autocodeApi.workspaces.subscribeInspection(taskId, () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.workspace(taskId) });
    });
  }, [enabled, queryClient, taskId]);
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
    onSuccess: (result) => {
      syncWorkspaceCollections(queryClient, result);
      if (taskId !== null) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.workspaceRecentCommits(taskId) });
        void queryClient.invalidateQueries({ queryKey: queryKeys.workspacePublishStatus(taskId) });
      }
    },
    onError: async () => {
      if (taskId !== null) {
        await invalidateWorkspaceCollectionsForTask(queryClient, taskId);
      }
    }
  });
}

export function usePushWorkspaceBranchMutation(taskId: number | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => {
      if (taskId === null) {
        throw new Error('Select a task workspace before pushing this branch.');
      }

      return autocodeApi.workspaces.pushBranch({
        taskId
      } satisfies WorkspacePushInput);
    },
    onSuccess: async () => {
      if (taskId !== null) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.workspacePublishStatus(taskId) });
      }
    },
    onError: async () => {
      if (taskId !== null) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.workspacePublishStatus(taskId) });
      }
    }
  });
}

export function useCreatePullRequestMutation(taskId: number | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => {
      if (taskId === null) {
        throw new Error('Select a task workspace before creating a pull request.');
      }

      return autocodeApi.workspaces.createPullRequest({
        taskId
      } satisfies WorkspaceCreatePullRequestInput);
    },
    onSuccess: async () => {
      if (taskId !== null) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.workspacePublishStatus(taskId) });
      }
    },
    onError: async () => {
      if (taskId !== null) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.workspacePublishStatus(taskId) });
      }
    }
  });
}

export function useOpenPullRequestMutation(taskId: number | null) {
  return useMutation({
    mutationFn: () => {
      if (taskId === null) {
        throw new Error('Select a task workspace before opening a pull request.');
      }

      return autocodeApi.workspaces.openPullRequest({
        taskId
      } satisfies WorkspaceOpenPullRequestInput);
    }
  });
}

export function useIntegrateBaseMutation(taskId: number | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => {
      if (taskId === null) {
        throw new Error('Select a task workspace before integrating from its base.');
      }

      return autocodeApi.workspaces.integrateBase({
        taskId
      } satisfies WorkspaceIntegrateBaseInput);
    },
    onSuccess: async () => {
      if (taskId !== null) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.workspace(taskId) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.workspaceRecentCommits(taskId) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.workspacePublishStatus(taskId) }),
          invalidateWorkspaceCollectionsForTask(queryClient, taskId)
        ]);
      }
    },
    onError: async () => {
      if (taskId !== null) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.workspace(taskId) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.workspacePublishStatus(taskId) }),
          invalidateWorkspaceCollectionsForTask(queryClient, taskId)
        ]);
      }
    }
  });
}

export function useMergeTaskIntoWorkspaceMutation(taskId: number | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sourceTaskId: number) => {
      if (taskId === null) {
        throw new Error('Select a task workspace before integrating another task.');
      }

      return autocodeApi.workspaces.mergeTask({
        sourceTaskId,
        taskId
      } satisfies WorkspaceMergeTaskInput);
    },
    onSuccess: async () => {
      if (taskId !== null) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.workspace(taskId) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.workspaceRecentCommits(taskId) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.workspacePublishStatus(taskId) }),
          invalidateWorkspaceCollectionsForTask(queryClient, taskId)
        ]);
      }
    },
    onError: async () => {
      if (taskId !== null) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.workspace(taskId) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.workspacePublishStatus(taskId) }),
          invalidateWorkspaceCollectionsForTask(queryClient, taskId)
        ]);
      }
    }
  });
}

function syncWorkspaceCollections(
  queryClient: ReturnType<typeof useQueryClient>,
  input: WorkspaceCollectionSync
) {
  queryClient.setQueryData<TaskWorkspace[]>(
    queryKeys.taskWorkspaces(input.project.id),
    (current) => {
      if (!current) {
        return current;
      }

      return upsertTaskWorkspace(current, input.taskWorkspace);
    }
  );

  queryClient.setQueryData<Project[]>(queryKeys.projects, (current) => {
    if (!current) {
      return current;
    }

    return upsertProject(current, input.project);
  });
}

async function invalidateWorkspaceCollectionsForTask(
  queryClient: ReturnType<typeof useQueryClient>,
  taskId: number
) {
  await invalidateTaskWorkspaceCollectionsForTask(queryClient, taskId);
}

export function useWorkspaceBranchesQuery(taskId: number | null) {
  return useQuery({
    enabled: taskId !== null,
    queryKey: taskId !== null ? queryKeys.workspaceBranches(taskId) : ['workspace', 'idle', 'branches'],
    queryFn: () => autocodeApi.workspaces.listBranches({ taskId: taskId! }),
    staleTime: 30_000
  });
}

export function useUpdateBaseRefMutation(taskId: number | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (baseRef: string) => {
      if (taskId === null) throw new Error('No active task');
      return autocodeApi.workspaces.updateBaseRef({ taskId, baseRef });
    },
    onSuccess: async () => {
      if (taskId !== null) {
        await invalidateWorkspaceCollectionsForTask(queryClient, taskId);
      }
    }
  });
}
