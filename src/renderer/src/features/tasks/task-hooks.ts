import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { CreateTaskInput, DeleteTaskInput } from '@shared/contracts/tasks';
import type { TaskWorkspace } from '@shared/domain/task-workspace';

import { autocodeApi } from '../../lib/autocode-api';
import { queryKeys } from '../../lib/query-keys';
import { upsertTaskWorkspace } from '../../lib/task-workspace-cache';

export function useTaskWorkspacesQuery(projectId: number | null) {
  return useQuery({
    enabled: projectId !== null,
    queryKey: projectId !== null ? queryKeys.taskWorkspaces(projectId) : ['tasks', 'idle'],
    queryFn: () => autocodeApi.tasks.listByProject({ projectId: projectId! })
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
        queryClient.setQueryData<TaskWorkspace[]>(queryKeys.taskWorkspaces(projectId), (current) =>
          current?.filter((workspace) => workspace.task.id !== input.taskId) ?? []
        );
      }

      queryClient.removeQueries({ queryKey: queryKeys.workspace(input.taskId) });
      queryClient.removeQueries({ queryKey: queryKeys.agentSessions(input.taskId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    }
  });
}
