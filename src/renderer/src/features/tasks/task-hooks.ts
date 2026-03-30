import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { CreateTaskInput } from '@shared/contracts/tasks';
import type { TaskWorkspace } from '@shared/domain/task-workspace';

import { autocodeApi } from '../../lib/autocode-api';

export function useTaskWorkspacesQuery(projectId: number | null) {
  return useQuery({
    enabled: projectId !== null,
    queryKey: ['tasks', projectId],
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
      queryClient.setQueryData<TaskWorkspace[]>(['tasks', projectId], (current) => {
        const next = current ? current.filter((entry) => entry.task.id !== workspace.task.id) : [];
        return [workspace, ...next].sort((left, right) =>
          right.task.updatedAt.localeCompare(left.task.updatedAt)
        );
      });

      await queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
    onSettled: async () => {
      if (projectId !== null) {
        await queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      }
    }
  });
}
