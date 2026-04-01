import path from 'node:path';
import { realpath, stat } from 'node:fs/promises';

import type { AppDatabase } from '../database/client';
import { createTaskWorkspaceRepository, type TaskWorkspaceContext } from './task-workspace-repository';
import { execGit, listRegisteredWorktrees } from './git-client';

export interface ResolvedWorkspaceContext extends TaskWorkspaceContext {
  worktreePath: string;
}

export function createWorkspaceRuntime(db: AppDatabase) {
  const taskWorkspaceRepository = createTaskWorkspaceRepository(db);

  return {
    taskWorkspaceRepository,

    async resolveWorkspaceContext(taskId: number): Promise<ResolvedWorkspaceContext> {
      let context = taskWorkspaceRepository.findWorkspaceContextByTaskId(taskId);

      if (!context) {
        throw new Error('Workspace could not be found.');
      }

      try {
        const worktreePath = await resolveWorkspaceRoot(context.worktree.worktreePath);
        const topLevelPath = await realpath(
          await execGit(['rev-parse', '--show-toplevel'], worktreePath)
        );

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
          const timestamp = new Date().toISOString();
          taskWorkspaceRepository.recordWorkspaceHealth({
            lastError: null,
            taskId,
            timestamp,
            worktreeStatus: context.worktree.status === 'dirty' ? 'dirty' : 'ready'
          });

          context = taskWorkspaceRepository.findWorkspaceContextByTaskId(taskId) ?? context;
        }

        return {
          ...context,
          worktreePath
        };
      } catch (error) {
        const message = normalizeWorkspaceError(error);
        taskWorkspaceRepository.recordWorkspaceHealth({
          lastError: message,
          taskId,
          timestamp: new Date().toISOString(),
          worktreeStatus: 'failed'
        });
        throw new Error(message);
      }
    }
  };
}

export function normalizeRelativePath(relativePath: string): string {
  if (!relativePath) {
    return '';
  }

  const normalized = path.posix.normalize(relativePath.replaceAll('\\', '/')).replace(/^\/+/, '');
  return normalized === '.' ? '' : normalized;
}

export function normalizeNonEmptyRelativePath(relativePath: string): string {
  const normalized = normalizeRelativePath(relativePath);

  if (!normalized) {
    throw new Error('A file path is required.');
  }

  return normalized;
}

export function resolveWorkspacePath(worktreePath: string, relativePath: string): string {
  const normalizedRelativePath = normalizeRelativePath(relativePath);
  const resolvedPath = path.resolve(worktreePath, normalizedRelativePath);
  if (!isPathWithinRoot(worktreePath, resolvedPath)) {
    throw new Error('Requested path is outside the selected workspace.');
  }

  return resolvedPath;
}

export async function resolveWorkspaceTargetPath(
  worktreePath: string,
  relativePath: string
): Promise<string> {
  const candidatePath = resolveWorkspacePath(worktreePath, relativePath);
  // Resolve symlinks before touching the filesystem so workspace-scoped requests
  // cannot escape the validated worktree root through an in-tree link target.
  const targetPath = await realpath(candidatePath);

  if (!isPathWithinRoot(worktreePath, targetPath)) {
    throw new Error('Requested path is outside the selected workspace.');
  }

  return targetPath;
}

export function normalizeWorkspaceError(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'Autocode could not inspect the selected workspace.';
  }

  const message = error.message;

  if (message.includes('cannot change to') || message.includes('not a git repository')) {
    return 'The project repository for this workspace is no longer available to Git.';
  }

  return message;
}

export function isMissingPathError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: string }).code === 'ENOENT'
  );
}

export function isNotDirectoryError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: string }).code === 'ENOTDIR'
  );
}

function isPathWithinRoot(worktreePath: string, candidatePath: string): boolean {
  const rootWithSeparator = `${worktreePath}${path.sep}`;
  return candidatePath === worktreePath || candidatePath.startsWith(rootWithSeparator);
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
