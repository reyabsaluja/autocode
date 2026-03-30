import path from 'node:path';
import { readdir, realpath, stat } from 'node:fs/promises';

import type { WorkspaceCommitInput, WorkspaceDiffInput, WorkspaceDirectoryInput } from '../../shared/contracts/workspaces';
import type {
  WorkspaceChange,
  WorkspaceCommitResult,
  WorkspaceDiff,
  WorkspaceDirectoryEntry,
  WorkspaceDirectorySnapshot
} from '../../shared/domain/workspace-inspection';
import type { AppDatabase } from '../database/client';
import { createTaskWorkspaceRepository, type TaskWorkspaceContext } from './task-workspace-repository';
import { execGit, listRegisteredWorktrees } from './git-client';

interface ResolvedWorkspaceContext extends TaskWorkspaceContext {
  worktreePath: string;
}

export function createWorkspaceService(db: AppDatabase) {
  const taskWorkspaceRepository = createTaskWorkspaceRepository(db);

  return {
    async listDirectory(input: WorkspaceDirectoryInput): Promise<WorkspaceDirectorySnapshot> {
      const context = await resolveWorkspaceContext(taskWorkspaceRepository, input.taskId);
      const relativePath = normalizeRelativePath(input.relativePath);
      const absoluteDirectoryPath = resolveWorkspacePath(context.worktreePath, relativePath);
      const entries = await readDirectoryEntries(absoluteDirectoryPath);

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
      const context = await resolveWorkspaceContext(taskWorkspaceRepository, taskId);
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
      const context = await resolveWorkspaceContext(taskWorkspaceRepository, input.taskId);
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
      const context = await resolveWorkspaceContext(taskWorkspaceRepository, input.taskId);
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

async function resolveWorkspaceContext(
  taskWorkspaceRepository: ReturnType<typeof createTaskWorkspaceRepository>,
  taskId: number
): Promise<ResolvedWorkspaceContext> {
  const context = taskWorkspaceRepository.findWorkspaceContextByTaskId(taskId);

  if (!context) {
    throw new Error('Workspace could not be found.');
  }

  try {
    const worktreePath = await resolveWorkspaceRoot(context.worktree.worktreePath);
    const topLevelPath = await realpath(await execGit(['rev-parse', '--show-toplevel'], worktreePath));

    if (topLevelPath !== worktreePath) {
      throw new Error('Stored workspace path no longer matches the task worktree root.');
    }

    const currentBranch = await execGit(['branch', '--show-current'], worktreePath);

    if (!currentBranch) {
      throw new Error('Workspace is not currently attached to a branch.');
    }

    if (currentBranch !== context.worktree.branchName) {
      throw new Error(
        `Workspace branch drifted from ${context.worktree.branchName} to ${currentBranch}.`
      );
    }

    const registeredWorktrees = await listRegisteredWorktrees(context.project.gitRoot);

    if (!registeredWorktrees.has(worktreePath)) {
      throw new Error('Stored workspace is no longer registered with the project repository.');
    }

    if (context.task.lastError || context.worktree.status === 'failed') {
      taskWorkspaceRepository.recordWorkspaceObservation(
        taskId,
        context.worktree.status === 'dirty' ? 'dirty' : 'ready',
        null,
        new Date().toISOString()
      );
    }

    return {
      ...context,
      worktreePath
    };
  } catch (error) {
    const message = normalizeWorkspaceError(error);
    taskWorkspaceRepository.recordWorkspaceObservation(
      taskId,
      'failed',
      message,
      new Date().toISOString()
    );
    throw new Error(message);
  }
}

async function resolveWorkspaceRoot(worktreePath: string): Promise<string> {
  try {
    const resolvedPath = await realpath(worktreePath);
    const workspaceStats = await stat(resolvedPath);

    if (!workspaceStats.isDirectory()) {
      throw new Error('Stored workspace path is not a directory.');
    }

    return resolvedPath;
  } catch (error) {
    if (isMissingPathError(error)) {
      throw new Error('The worktree folder for this task no longer exists on disk.');
    }

    if (error instanceof Error && error.message === 'Stored workspace path is not a directory.') {
      throw error;
    }

    throw error instanceof Error
      ? error
      : new Error('Autocode could not inspect the task worktree.');
  }
}

async function readDirectoryEntries(directoryPath: string) {
  try {
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

function normalizeWorkspaceError(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'Autocode could not inspect the selected workspace.';
  }

  const message = error.message;

  if (message.includes('cannot change to') || message.includes('not a git repository')) {
    return 'The project repository for this workspace is no longer available to Git.';
  }

  return message;
}

function normalizeCommitError(message: string): string {
  if (message.includes('Author identity unknown') || message.includes('Please tell me who you are')) {
    return 'Git user.name and user.email are not configured for commits on this machine.';
  }

  return message;
}

function isMissingPathError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: string }).code === 'ENOENT'
  );
}

function isNotDirectoryError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: string }).code === 'ENOTDIR'
  );
}
