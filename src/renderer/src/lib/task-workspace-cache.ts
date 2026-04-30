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

  for (let listIndex = 0; listIndex < taskLists.length; listIndex += 1) {
    const [, taskWorkspaces] = taskLists[listIndex]!;

    if (!taskWorkspaces) {
      continue;
    }

    for (let workspaceIndex = 0; workspaceIndex < taskWorkspaces.length; workspaceIndex += 1) {
      const workspace = taskWorkspaces[workspaceIndex]!;

      if (workspace.task.id === taskId) {
        return workspace.task.projectId;
      }
    }
  }

  return null;
}

function compareTaskWorkspacesByUpdatedAt(left: TaskWorkspace, right: TaskWorkspace) {
  if (right.task.updatedAt > left.task.updatedAt) {
    return 1;
  }

  if (right.task.updatedAt < left.task.updatedAt) {
    return -1;
  }

  return right.task.id - left.task.id;
}

function compareProjectsByUpdatedAt(left: Project, right: Project) {
  if (right.updatedAt > left.updatedAt) {
    return 1;
  }

  if (right.updatedAt < left.updatedAt) {
    return -1;
  }

  return right.id - left.id;
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
  let existingIndex = -1;

  for (let index = 0; index < next.length; index += 1) {
    if (isSameEntry(next[index]!)) {
      existingIndex = index;
      break;
    }
  }

  if (existingIndex !== -1) {
    next.splice(existingIndex, 1);
  }

  let insertAt = next.length;

  for (let index = 0; index < next.length; index += 1) {
    if (compareEntries(nextEntry, next[index]!) < 0) {
      insertAt = index;
      break;
    }
  }

  next.splice(insertAt, 0, nextEntry);
  return next;
}
