import type { QueryClient } from '@tanstack/react-query';

import type { TaskWorkspaceCollectionSync } from '@shared/contracts/tasks';
import type { Project } from '@shared/domain/project';
import type { TaskWorkspace } from '@shared/domain/task-workspace';

import { queryKeys } from './query-keys';

export function syncTaskWorkspaceCollections(
  queryClient: QueryClient,
  input: TaskWorkspaceCollectionSync
) {
  queryClient.setQueryData<TaskWorkspace[]>(
    queryKeys.taskWorkspaces(input.project.id),
    (current) => {
      if (!current) {
        return current;
      }

      const next = current.filter((entry) => entry.task.id !== input.taskWorkspace.task.id);
      return [input.taskWorkspace, ...next].sort(compareTaskWorkspacesByUpdatedAt);
    }
  );

  queryClient.setQueryData<Project[]>(queryKeys.projects, (current) => {
    if (!current) {
      return current;
    }

    const next = current.filter((entry) => entry.id !== input.project.id);
    return [input.project, ...next].sort(compareProjectsByUpdatedAt);
  });
}

export async function invalidateTaskWorkspaceCollectionsForTask(
  queryClient: QueryClient,
  taskId: number
) {
  const projectId = findProjectIdForTask(queryClient, taskId);

  if (projectId !== null) {
    await queryClient.invalidateQueries({ queryKey: queryKeys.taskWorkspaces(projectId) });
  }

  await queryClient.invalidateQueries({ queryKey: queryKeys.projects });
}

function findProjectIdForTask(queryClient: QueryClient, taskId: number): number | null {
  const taskLists = queryClient.getQueriesData<TaskWorkspace[]>({ queryKey: ['tasks'] });

  for (const [, taskWorkspaces] of taskLists) {
    if (!taskWorkspaces) {
      continue;
    }

    const matchingWorkspace = taskWorkspaces.find((workspace) => workspace.task.id === taskId);

    if (matchingWorkspace) {
      return matchingWorkspace.task.projectId;
    }
  }

  return null;
}

function compareTaskWorkspacesByUpdatedAt(left: TaskWorkspace, right: TaskWorkspace) {
  return right.task.updatedAt.localeCompare(left.task.updatedAt);
}

function compareProjectsByUpdatedAt(left: Project, right: Project) {
  return right.updatedAt.localeCompare(left.updatedAt);
}
