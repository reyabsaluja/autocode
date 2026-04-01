import { readdir } from 'node:fs/promises';

import type {
  WorkspaceChangesResult,
  WorkspaceCommitInput,
  WorkspaceCommitResult,
  WorkspaceDiffInput,
  WorkspaceDirectoryInput
} from '../../shared/contracts/workspaces';
import type {
  WorkspaceChange,
  WorkspaceDiff,
  WorkspaceDirectoryEntry,
  WorkspaceDirectorySnapshot
} from '../../shared/domain/workspace-inspection';
import type { TaskStatus } from '../../shared/domain/task';
import type { AppDatabase } from '../database/client';
import { execGit } from './git-client';
import {
  createWorkspaceRuntime,
  isMissingPathError,
  isNotDirectoryError,
  normalizeNonEmptyRelativePath,
  normalizeRelativePath,
  normalizeWorkspaceError,
  resolveWorkspaceTargetPath
} from './workspace-runtime';

export function createWorkspaceService(db: AppDatabase) {
  const workspaceRuntime = createWorkspaceRuntime(db);
  const { taskWorkspaceRepository } = workspaceRuntime;

  return {
    async listDirectory(input: WorkspaceDirectoryInput): Promise<WorkspaceDirectorySnapshot> {
      const context = await workspaceRuntime.resolveWorkspaceContext(input.taskId);
      const relativePath = normalizeRelativePath(input.relativePath ?? '');
      const entries = await readDirectoryEntries(context.worktreePath, relativePath);

      const directoryEntries: WorkspaceDirectoryEntry[] = entries
        .filter((entry) => entry.name !== '.git')
        .map((entry) => ({
          kind: entry.isDirectory() ? ('directory' as const) : ('file' as const),
          name: entry.name,
          relativePath: joinRelativePath(relativePath, entry.name)
        }))
        .sort((left, right) => {
          if (left.kind !== right.kind) {
            return left.kind === 'directory' ? -1 : 1;
          }

          return left.name.localeCompare(right.name);
        });

      return {
        entries: directoryEntries,
        relativePath
      };
    },

    async listChanges(taskId: number): Promise<WorkspaceChangesResult> {
      const timestamp = new Date().toISOString();

      try {
        const context = await workspaceRuntime.observeWorkspaceContext(taskId);
        const changes = await listWorkspaceChanges(context.worktreePath);
        const observation = taskWorkspaceRepository.recordWorkspaceHealth({
          lastError: null,
          taskId,
          timestamp,
          worktreeStatus: changes.length > 0 ? 'dirty' : 'ready'
        });

        return {
          changes,
          observation: {
            didHealthChange: observation.didChange,
            project: observation.project,
            taskWorkspace: observation.taskWorkspace
          }
        };
      } catch (error) {
        throw persistWorkspaceObservationFailure(taskWorkspaceRepository, taskId, timestamp, error);
      }
    },

    async getDiff(input: WorkspaceDiffInput): Promise<WorkspaceDiff | null> {
      const context = await workspaceRuntime.resolveWorkspaceContext(input.taskId);
      const relativePath = normalizeNonEmptyRelativePath(input.relativePath);
      const diffText = await resolveWorkspaceDiffText(context.worktreePath, {
        previousPath: input.previousPath ?? null,
        relativePath,
        status: input.status
      });

      if (!diffText) {
        return null;
      }

      return {
        relativePath,
        text: diffText
      };
    },

    async commitAll(input: WorkspaceCommitInput): Promise<WorkspaceCommitResult> {
      const timestamp = new Date().toISOString();
      let context: Awaited<ReturnType<typeof workspaceRuntime.observeWorkspaceContext>>;

      try {
        context = await workspaceRuntime.observeWorkspaceContext(input.taskId);
      } catch (error) {
        throw persistWorkspaceObservationFailure(
          taskWorkspaceRepository,
          input.taskId,
          timestamp,
          error
        );
      }

      const message = input.message.trim();

      try {
        await execGit(['add', '--all'], context.worktreePath);
      } catch (error) {
        throw persistWorkspaceObservationFailure(
          taskWorkspaceRepository,
          input.taskId,
          timestamp,
          error
        );
      }

      try {
        await execGit(['commit', '-m', message], context.worktreePath);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Autocode could not create the commit.';

        if (errorMessage.includes('nothing to commit')) {
          taskWorkspaceRepository.recordWorkspaceHealth({
            lastError: null,
            taskId: input.taskId,
            timestamp,
            worktreeStatus: 'ready'
          });
          throw new Error('This workspace has no changes to commit.');
        }

        taskWorkspaceRepository.recordWorkspaceHealth({
          lastError: normalizeCommitError(errorMessage),
          taskId: input.taskId,
          timestamp,
          worktreeStatus: 'dirty'
        });

        throw new Error(normalizeCommitError(errorMessage));
      }

      const commitSha = await execGit(['rev-parse', 'HEAD'], context.worktreePath);
      const operationalTaskStatus = resolveOperationalTaskStatus(
        context.task.status,
        context.taskStatusBeforeFailure
      );
      const nextStatus = operationalTaskStatus === 'ready' ? 'in_progress' : operationalTaskStatus;

      taskWorkspaceRepository.touchTaskWorkspace(
        context.task.id,
        context.project.id,
        nextStatus,
        timestamp
      );

      return {
        commitMessage: message,
        commitSha,
        project: {
          ...context.project,
          updatedAt: timestamp
        },
        taskId: context.task.id,
        taskWorkspace: {
          task: {
            ...context.task,
            lastError: null,
            status: nextStatus,
            updatedAt: timestamp
          },
          worktree: {
            ...context.worktree,
            status: 'ready',
            updatedAt: timestamp
          }
        }
      };
    }
  };
}

function persistWorkspaceObservationFailure(
  taskWorkspaceRepository: ReturnType<typeof createWorkspaceRuntime>['taskWorkspaceRepository'],
  taskId: number,
  timestamp: string,
  error: unknown
): Error {
  const message = normalizeWorkspaceError(error);
  taskWorkspaceRepository.recordWorkspaceHealth({
    lastError: message,
    taskId,
    timestamp,
    worktreeStatus: 'failed'
  });

  return new Error(message);
}

function resolveOperationalTaskStatus(
  taskStatus: TaskStatus,
  taskStatusBeforeFailure: TaskStatus | null
): TaskStatus {
  if (taskStatus === 'failed') {
    return taskStatusBeforeFailure ?? 'ready';
  }

  return taskStatus;
}

async function listWorkspaceChanges(worktreePath: string): Promise<WorkspaceChange[]> {
  const output = await execGit(
    ['status', '--porcelain=v1', '-z', '--untracked-files=all'],
    worktreePath
  );

  if (!output) {
    return [];
  }

  return parseWorkspaceChanges(output);
}

async function resolveWorkspaceDiffText(
  worktreePath: string,
  input: Pick<WorkspaceDiffInput, 'previousPath' | 'relativePath' | 'status'>
): Promise<string | null> {
  const hintedChange = createHintedWorkspaceChange(input);

  if (hintedChange) {
    return resolveWorkspaceDiff(worktreePath, hintedChange);
  }

  const trackedDiffText = await resolveTrackedWorkspaceDiff(worktreePath, input.relativePath);

  if (trackedDiffText) {
    return trackedDiffText;
  }

  const output = await execGit(
    ['status', '--porcelain=v1', '-z', '--untracked-files=all', '--', input.relativePath],
    worktreePath
  );

  if (!output) {
    return null;
  }

  const change =
    parseWorkspaceChanges(output).find((entry) => entry.relativePath === input.relativePath) ?? null;

  if (!change) {
    return null;
  }

  return resolveWorkspaceDiff(worktreePath, change);
}

async function resolveWorkspaceDiff(worktreePath: string, change: WorkspaceChange): Promise<string> {
  if (change.status === 'untracked') {
    return execGit(
      ['diff', '--no-index', '--', getEmptyFileReference(), change.relativePath],
      worktreePath,
      { allowedExitCodes: [1] }
    );
  }

  if (change.status === 'renamed') {
    return execGit(
      [
        'diff',
        'HEAD',
        '--find-renames',
        '--',
        change.previousPath ?? change.relativePath,
        change.relativePath
      ],
      worktreePath,
      { allowedExitCodes: [1] }
    );
  }

  return execGit(
    ['diff', 'HEAD', '--', change.relativePath],
    worktreePath,
    { allowedExitCodes: [1] }
  );
}

async function resolveTrackedWorkspaceDiff(
  worktreePath: string,
  relativePath: string
): Promise<string> {
  return execGit(
    ['diff', 'HEAD', '--find-renames', '--', relativePath],
    worktreePath,
    { allowedExitCodes: [1] }
  );
}

function createHintedWorkspaceChange(
  input: Pick<WorkspaceDiffInput, 'previousPath' | 'relativePath' | 'status'>
): WorkspaceChange | null {
  if (!input.status) {
    return null;
  }

  if (input.status === 'renamed' && !input.previousPath) {
    return null;
  }

  return {
    previousPath: input.previousPath ?? null,
    relativePath: input.relativePath,
    status: input.status
  };
}

function parseWorkspaceChanges(output: string): WorkspaceChange[] {
  const tokens = output.split('\0');
  const changes: WorkspaceChange[] = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const record = tokens[index];

    if (!record) {
      continue;
    }

    const statusCode = record.slice(0, 2);
    const currentPath = decodeGitPath(record.slice(3));

    if (statusCode === '??') {
      changes.push({
        previousPath: null,
        relativePath: currentPath,
        status: 'untracked'
      });
      continue;
    }

    if (statusCode.includes('R')) {
      const previousPath = decodeGitPath(tokens[index + 1] ?? '');
      index += 1;
      changes.push({
        previousPath: previousPath || null,
        relativePath: currentPath,
        status: 'renamed'
      });
      continue;
    }

    changes.push({
      previousPath: null,
      relativePath: currentPath,
      status: mapStatusCode(statusCode)
    });
  }

  return changes;
}

function mapStatusCode(statusCode: string): WorkspaceChange['status'] {
  if (statusCode.includes('A')) {
    return 'added';
  }

  if (statusCode.includes('D')) {
    return 'deleted';
  }

  return 'modified';
}

function decodeGitPath(value: string): string {
  const trimmed = value.trim();

  if (!trimmed.startsWith('"') || !trimmed.endsWith('"')) {
    return trimmed;
  }

  try {
    return JSON.parse(trimmed) as string;
  } catch {
    return trimmed.slice(1, -1);
  }
}

function joinRelativePath(parentPath: string, entryName: string): string {
  return parentPath ? `${parentPath}/${entryName}` : entryName;
}

function getEmptyFileReference(): string {
  return process.platform === 'win32' ? 'NUL' : '/dev/null';
}

async function readDirectoryEntries(worktreePath: string, relativePath: string) {
  try {
    const directoryPath = await resolveWorkspaceTargetPath(worktreePath, relativePath);
    return await readdir(directoryPath, {
      withFileTypes: true
    });
  } catch (error) {
    if (isMissingPathError(error)) {
      throw new Error('This folder no longer exists in the selected workspace.');
    }

    if (isNotDirectoryError(error)) {
      throw new Error('Selected path is not a directory inside this workspace.');
    }

    throw error instanceof Error
      ? error
      : new Error('Autocode could not read this workspace directory.');
  }
}

function normalizeCommitError(message: string): string {
  if (message.includes('Author identity unknown') || message.includes('Please tell me who you are')) {
    return 'Git user.name and user.email are not configured for commits on this machine.';
  }

  return message;
}
