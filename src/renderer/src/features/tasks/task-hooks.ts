import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { CreateTaskInput, DeleteTaskInput } from '@shared/contracts/tasks';
import type { TaskWorkspace } from '@shared/domain/task-workspace';

import { autocodeApi } from '../../lib/autocode-api';
import { queryKeys } from '../../lib/query-keys';
import { upsertTaskWorkspace } from '../../lib/task-workspace-cache';

const TASK_WORKSPACES_STALE_TIME_MS = 30_000;
const TASK_WORKSPACES_GC_TIME_MS = 10 * 60_000;

export function useTaskWorkspacesQuery(projectId: number | null) {
  return useQuery({
    enabled: projectId !== null,
    queryKey: projectId !== null ? queryKeys.taskWorkspaces(projectId) : ['tasks', 'idle'],
    queryFn: () => autocodeApi.tasks.listByProject({ projectId: projectId! }),
    gcTime: TASK_WORKSPACES_GC_TIME_MS,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: TASK_WORKSPACES_STALE_TIME_MS
  });
}

export function useCreateTaskWorkspaceMutation(projectId: number | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: Omit<CreateTaskInput, 'projectId'>) => {
      if (projectId === null) {
        throw new Error('Select a project before creating a task workspace.');
      }

      return autocodeApi.tasks.create({
        projectId,
        ...input
      });
    },
    onSuccess: async (workspace) => {
      if (projectId === null) {
        return;
      }

      queryClient.setQueryData<TaskWorkspace[]>(queryKeys.taskWorkspaces(projectId), (current) => {
        return current ? upsertTaskWorkspace(current, workspace) : [workspace];
      });

      await queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    }
  });
}

export function useDeleteTaskWorkspaceMutation(projectId: number | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: DeleteTaskInput) => autocodeApi.tasks.delete(input),
    onSuccess: async (_result, input) => {
      if (projectId !== null) {
        queryClient.setQueryData<TaskWorkspace[]>(
          queryKeys.taskWorkspaces(projectId),
          (current) => removeTaskWorkspaceFromList(current ?? [], input.taskId)
        );
      }

      queryClient.removeQueries({ queryKey: queryKeys.workspace(input.taskId) });
      queryClient.removeQueries({ queryKey: queryKeys.agentSessions(input.taskId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    }
  });
}

function removeTaskWorkspaceFromList(current: TaskWorkspace[], taskId: number): TaskWorkspace[] {
  for (let index = 0; index < current.length; index += 1) {
    if (current[index]!.task.id !== taskId) {
      continue;
    }

    const next = current.slice();
    next.splice(index, 1);
    return next;
  }

  return current;
}
