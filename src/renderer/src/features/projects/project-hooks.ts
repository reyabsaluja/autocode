import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { AddProjectInput } from '@shared/contracts/projects';
import type { Project } from '@shared/domain/project';

import { autocodeApi } from '../../lib/autocode-api';

const projectsQueryKey = ['projects'];

export function useProjectsQuery() {
  return useQuery({
    queryKey: projectsQueryKey,
    queryFn: () => autocodeApi.projects.list()
  });
}

export function useAddProjectMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: AddProjectInput) => autocodeApi.projects.add(input),
    onSuccess: async (project) => {
      queryClient.setQueryData<Project[]>(projectsQueryKey, (current) => {
        const next = current ? current.filter((entry) => entry.id !== project.id) : [];
        return [project, ...next].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
      });

      await queryClient.invalidateQueries({ queryKey: projectsQueryKey });
    }
  });
}

