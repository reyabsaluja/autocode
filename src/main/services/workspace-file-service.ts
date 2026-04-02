import { readFile, stat, writeFile } from 'node:fs/promises';

import type {
  WorkspaceFileReadInput,
  WorkspaceFileReadResult,
  WorkspaceFileWriteInput,
  WorkspaceFileWriteResult
} from '../../shared/contracts/workspace-files';
import type { AppDatabase } from '../database/client';
import {
  createWorkspaceRuntime,
  isMissingPathError,
  isNotDirectoryError,
  normalizeNonEmptyRelativePath,
  resolveWorkspaceTargetPath
} from './workspace-runtime';

export function createWorkspaceFileService(
  db: AppDatabase,
  publishWorkspaceInspectionChange?: (taskId: number) => void
) {
  const workspaceRuntime = createWorkspaceRuntime(db);

  return {
    async readFile(input: WorkspaceFileReadInput): Promise<WorkspaceFileReadResult> {
      const context = await workspaceRuntime.resolveWorkspaceContext(input.taskId);
      const relativePath = normalizeNonEmptyRelativePath(input.relativePath);
      const { fileStats, targetPath } = await resolveWorkspaceFileTarget(
        context.worktreePath,
        relativePath
      );

      const buffer = await readFile(targetPath);
      const isBinary = buffer.includes(0);

      return {
        content: isBinary ? null : buffer.toString('utf8'),
        isBinary,
        relativePath,
        sizeBytes: fileStats.size
      };
    },

    async writeFile(input: WorkspaceFileWriteInput): Promise<WorkspaceFileWriteResult> {
      const context = await workspaceRuntime.resolveWorkspaceContext(input.taskId);
      const relativePath = normalizeNonEmptyRelativePath(input.relativePath);
      const { targetPath } = await resolveWorkspaceFileTarget(
        context.worktreePath,
        relativePath
      );
      const currentBuffer = await readFile(targetPath);

      if (currentBuffer.includes(0)) {
        throw new Error('This file became binary on disk and cannot be saved from the editor.');
      }

      if (currentBuffer.toString('utf8') !== input.expectedContent) {
        throw new Error('This file changed on disk. Reload it before saving so you can review the newer edits.');
      }

      await writeFile(targetPath, input.content, 'utf8');
      publishWorkspaceInspectionChange?.(input.taskId);

      return {
        relativePath,
        savedAt: new Date().toISOString(),
        sizeBytes: Buffer.byteLength(input.content, 'utf8')
      };
    }
  };
}

async function resolveWorkspaceFileTarget(worktreePath: string, relativePath: string) {
  try {
    const targetPath = await resolveWorkspaceTargetPath(worktreePath, relativePath);
    const fileStats = await stat(targetPath);

    if (!fileStats.isFile()) {
      throw new Error('Selected path is not a file inside this workspace.');
    }

    return {
      fileStats,
      targetPath
    };
  } catch (error) {
    if (isMissingPathError(error)) {
      throw new Error('This file no longer exists in the selected workspace.');
    }

    if (isNotDirectoryError(error)) {
      throw new Error('Selected file path is invalid for this workspace.');
    }

    if (error instanceof Error && error.message === 'Selected path is not a file inside this workspace.') {
      throw error;
    }

    throw error instanceof Error
      ? error
      : new Error('Autocode could not access this workspace file.');
  }
}
