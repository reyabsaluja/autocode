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

export function upsertTaskWorkspace(
  current: TaskWorkspace[],
  taskWorkspace: TaskWorkspace
): TaskWorkspace[] {
  return upsertSortedEntry(
    current,
    taskWorkspace,
    (entry) => entry.task.id === taskWorkspace.task.id,
    compareTaskWorkspacesByUpdatedAt
  );
}

export function upsertProject(
  current: Project[],
  project: Project
): Project[] {
  return upsertSortedEntry(
    current,
    project,
    (entry) => entry.id === project.id,
    compareProjectsByUpdatedAt
  );
}

function upsertSortedEntry<T>(
  current: T[],
  nextEntry: T,
  isSameEntry: (entry: T) => boolean,
  compareEntries: (left: T, right: T) => number
): T[] {
  const next = current.slice();
  const existingIndex = next.findIndex(isSameEntry);

  if (existingIndex !== -1) {
    next.splice(existingIndex, 1);
  }

  const insertAt = next.findIndex((entry) => compareEntries(nextEntry, entry) < 0);
  next.splice(insertAt === -1 ? next.length : insertAt, 0, nextEntry);
  return next;
}
