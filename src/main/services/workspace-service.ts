import path from 'node:path';
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
import { createTaskWorkspaceRepository } from './task-workspace-repository';
import { execGit } from './git-client';

export function createWorkspaceService(db: AppDatabase) {
  const taskWorkspaceRepository = createTaskWorkspaceRepository(db);

  return {
    async listDirectory(input: WorkspaceDirectoryInput): Promise<WorkspaceDirectorySnapshot> {
      const context = getWorkspaceContext(taskWorkspaceRepository.findWorkspaceContextByTaskId(input.taskId));
      const relativePath = normalizeRelativePath(input.relativePath);
      const absoluteDirectoryPath = resolveWorkspacePath(context.worktree.worktreePath, relativePath);
      const entries = await readdir(absoluteDirectoryPath, {
        withFileTypes: true
      });

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
      const context = getWorkspaceContext(taskWorkspaceRepository.findWorkspaceContextByTaskId(taskId));
      return listWorkspaceChanges(context.worktree.worktreePath);
    },

    async getDiff(input: WorkspaceDiffInput): Promise<WorkspaceDiff | null> {
      const context = getWorkspaceContext(taskWorkspaceRepository.findWorkspaceContextByTaskId(input.taskId));
      const relativePath = normalizeNonEmptyRelativePath(input.relativePath);
      const changes = await listWorkspaceChanges(context.worktree.worktreePath);
      const change = changes.find((entry) => entry.relativePath === relativePath);

      if (!change) {
        return null;
      }

      const diffText = await resolveWorkspaceDiff(context.worktree.worktreePath, change);

      if (!diffText) {
        return null;
      }

      return {
        relativePath,
        text: diffText
      };
    },

    async commitAll(input: WorkspaceCommitInput): Promise<WorkspaceCommitResult> {
      const context = getWorkspaceContext(taskWorkspaceRepository.findWorkspaceContextByTaskId(input.taskId));
      const changes = await listWorkspaceChanges(context.worktree.worktreePath);

      if (changes.length === 0) {
        throw new Error('This workspace has no changes to commit.');
      }

      const message = input.message.trim();
      await execGit(['add', '--all'], context.worktree.worktreePath);

      try {
        await execGit(['commit', '-m', message], context.worktree.worktreePath);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Autocode could not create the commit.';

        if (errorMessage.includes('nothing to commit')) {
          throw new Error('This workspace has no changes to commit.');
        }

        throw error instanceof Error ? error : new Error(errorMessage);
      }

      const commitSha = await execGit(['rev-parse', 'HEAD'], context.worktree.worktreePath);
      const timestamp = new Date().toISOString();
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
    ['status', '--porcelain=v1', '--untracked-files=all'],
    worktreePath
  );

  if (!output) {
    return [];
  }

  return output
    .split('\n')
    .filter(Boolean)
    .map(parseWorkspaceChangeLine);
}

async function resolveWorkspaceDiff(worktreePath: string, change: WorkspaceChange): Promise<string> {
  if (change.status === 'untracked') {
    const filePath = resolveWorkspacePath(worktreePath, change.relativePath);
    return execGit(
      ['diff', '--no-index', '--', getEmptyFileReference(), filePath],
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

function parseWorkspaceChangeLine(line: string): WorkspaceChange {
  const statusCode = line.slice(0, 2);
  const rawPath = line.slice(3).trim();
  const renameParts = rawPath.split(' -> ');

  if (statusCode === '??') {
    return {
      previousPath: null,
      relativePath: decodeGitPath(rawPath),
      status: 'untracked'
    };
  }

  if (statusCode.includes('R')) {
    return {
      previousPath: decodeGitPath(renameParts[0] ?? rawPath),
      relativePath: decodeGitPath(renameParts.at(-1) ?? rawPath),
      status: 'renamed'
    };
  }

  return {
    previousPath: null,
    relativePath: decodeGitPath(rawPath),
    status: mapStatusCode(statusCode)
  };
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

function getWorkspaceContext<T>(context: T | null): T {
  if (!context) {
    throw new Error('Workspace could not be found.');
  }

  return context;
}

function normalizeRelativePath(relativePath: string): string {
  if (!relativePath) {
    return '';
  }

  const normalized = path.posix.normalize(relativePath.replaceAll('\\', '/')).replace(/^\/+/, '');
  return normalized === '.' ? '' : normalized;
}

function normalizeNonEmptyRelativePath(relativePath: string): string {
  const normalized = normalizeRelativePath(relativePath);

  if (!normalized) {
    throw new Error('A file path is required.');
  }

  return normalized;
}

function resolveWorkspacePath(worktreePath: string, relativePath: string): string {
  const normalizedRelativePath = normalizeRelativePath(relativePath);
  const resolvedPath = path.resolve(worktreePath, normalizedRelativePath);
  const rootWithSeparator = `${worktreePath}${path.sep}`;

  if (resolvedPath !== worktreePath && !resolvedPath.startsWith(rootWithSeparator)) {
    throw new Error('Requested path is outside the selected workspace.');
  }

  return resolvedPath;
}

function joinRelativePath(parentPath: string, entryName: string): string {
  return parentPath ? `${parentPath}/${entryName}` : entryName;
}

function getEmptyFileReference(): string {
  return process.platform === 'win32' ? 'NUL' : '/dev/null';
}
