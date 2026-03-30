import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { AddProjectInput } from '@shared/contracts/projects';
import type { Project } from '@shared/domain/project';

import { autocodeApi } from '../../lib/autocode-api';
import { queryKeys } from '../../lib/query-keys';

export function useProjectsQuery() {
  return useQuery({
    queryKey: queryKeys.projects,
    queryFn: () => autocodeApi.projects.list()
  });
}

export function useAddProjectMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: AddProjectInput) => autocodeApi.projects.add(input),
    onSuccess: (project) => {
      queryClient.setQueryData<Project[]>(queryKeys.projects, (current) => {
        const next = current ? current.filter((entry) => entry.id !== project.id) : [];
        return [project, ...next].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
      });
    }
  });
}
