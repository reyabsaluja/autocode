import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  WorkspaceFileReadInput,
  WorkspaceFileWriteInput
} from '@shared/contracts/workspace-files';

import { autocodeApi } from '../../lib/autocode-api';
import { queryKeys } from '../../lib/query-keys';

export function useWorkspaceFileQuery(
  taskId: number | null,
  relativePath: string | null,
  enabled = true
) {
  return useQuery({
    enabled: taskId !== null && relativePath !== null && enabled,
    queryKey:
      taskId !== null && relativePath !== null
        ? queryKeys.workspaceFile(taskId, relativePath)
        : ['workspace', 'idle', 'file'],
    queryFn: () =>
      autocodeApi.workspaces.readFile({
        relativePath: relativePath!,
        taskId: taskId!
      } satisfies WorkspaceFileReadInput),
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    staleTime: 0
  });
}

export function useWriteWorkspaceFileMutation(taskId: number | null, relativePath: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: Omit<WorkspaceFileWriteInput, 'relativePath' | 'taskId'>) => {
      if (taskId === null || relativePath === null) {
        throw new Error('Open a workspace file before saving changes.');
      }

      return autocodeApi.workspaces.writeFile({
        content: input.content,
        relativePath,
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
