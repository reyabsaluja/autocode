import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { AddProjectInput, DeleteProjectInput } from '@shared/contracts/projects';
import type { Project } from '@shared/domain/project';

import { autocodeApi } from '../../lib/autocode-api';
import { queryKeys } from '../../lib/query-keys';
import { upsertProject } from '../../lib/task-workspace-cache';

const PROJECTS_STALE_TIME_MS = 60_000;
const PROJECTS_GC_TIME_MS = 10 * 60_000;

export function useProjectsQuery() {
  return useQuery({
    gcTime: PROJECTS_GC_TIME_MS,
    queryKey: queryKeys.projects,
    queryFn: () => autocodeApi.projects.list(),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: PROJECTS_STALE_TIME_MS
  });
}

export function useAddProjectMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: AddProjectInput) => autocodeApi.projects.add(input),
    onSuccess: (project) => {
      queryClient.setQueryData<Project[]>(queryKeys.projects, (current) => {
        return current ? upsertProject(current, project) : [project];
      });
    }
  });
}

export function useDeleteProjectMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: DeleteProjectInput) => autocodeApi.projects.delete(input),
    onSuccess: (_result, input) => {
      queryClient.setQueryData<Project[]>(queryKeys.projects, (current) =>
        current?.filter((project) => project.id !== input.projectId) ?? []
      );
      void queryClient.invalidateQueries({
        queryKey: queryKeys.taskWorkspaces(input.projectId)
      });
    }
  });
}
