import { readdir } from 'node:fs/promises';

import type { WorkspaceCommitInput, WorkspaceDiffInput, WorkspaceDirectoryInput } from '../../shared/contracts/workspaces';
import type {
  WorkspaceChange,
  WorkspaceCommitResult,
  WorkspaceDiff,
  WorkspaceDirectoryEntry,
  WorkspaceDirectorySnapshot
} from '../../shared/domain/workspace-inspection';
import type { AppDatabase } from '../database/client';
import { execGit } from './git-client';
import {
  createWorkspaceRuntime,
  isMissingPathError,
  isNotDirectoryError,
  normalizeNonEmptyRelativePath,
  normalizeRelativePath,
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

    async listChanges(taskId: number): Promise<WorkspaceChange[]> {
      const context = await workspaceRuntime.resolveWorkspaceContext(taskId);
      const changes = await listWorkspaceChanges(context.worktreePath);
      taskWorkspaceRepository.recordWorkspaceObservation(
        taskId,
        changes.length > 0 ? 'dirty' : 'ready',
        null,
        new Date().toISOString()
      );
      return changes;
    },

    async getDiff(input: WorkspaceDiffInput): Promise<WorkspaceDiff | null> {
      const context = await workspaceRuntime.resolveWorkspaceContext(input.taskId);
      const relativePath = normalizeNonEmptyRelativePath(input.relativePath);
      const changes = await listWorkspaceChanges(context.worktreePath);
      const change = changes.find((entry) => entry.relativePath === relativePath);

      if (!change) {
        return null;
      }

      const diffText = await resolveWorkspaceDiff(context.worktreePath, change);

      if (!diffText) {
        return null;
      }

      return {
        relativePath,
        text: diffText
      };
    },

    async commitAll(input: WorkspaceCommitInput): Promise<WorkspaceCommitResult> {
      const context = await workspaceRuntime.resolveWorkspaceContext(input.taskId);
      const changes = await listWorkspaceChanges(context.worktreePath);
      const timestamp = new Date().toISOString();

      if (changes.length === 0) {
        taskWorkspaceRepository.recordWorkspaceObservation(input.taskId, 'ready', null, timestamp);
        throw new Error('This workspace has no changes to commit.');
      }

      const message = input.message.trim();
      await execGit(['add', '--all'], context.worktreePath);

      try {
        await execGit(['commit', '-m', message], context.worktreePath);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Autocode could not create the commit.';

        if (errorMessage.includes('nothing to commit')) {
          taskWorkspaceRepository.recordWorkspaceObservation(input.taskId, 'ready', null, timestamp);
          throw new Error('This workspace has no changes to commit.');
        }

        taskWorkspaceRepository.recordWorkspaceObservation(
          input.taskId,
          'dirty',
          normalizeCommitError(errorMessage),
          timestamp
        );

        throw new Error(normalizeCommitError(errorMessage));
      }

      const commitSha = await execGit(['rev-parse', 'HEAD'], context.worktreePath);
      const nextStatus = context.task.status === 'ready' ? 'in_progress' : context.task.status;

      taskWorkspaceRepository.touchTaskWorkspace(
        context.task.id,
        context.project.id,
        nextStatus,
        timestamp
      );

      return {
        commitMessage: message,
        commitSha,
        taskId: context.task.id
      };
    }
  };
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
