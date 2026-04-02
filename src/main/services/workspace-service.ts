import { readdir } from 'node:fs/promises';

import type {
  WorkspaceChangesResult,
  WorkspaceCommitInput,
  WorkspaceCommitResult,
  WorkspaceCreatePullRequestInput,
  WorkspaceDiffInput,
  WorkspaceDirectoryInput,
  WorkspaceOpenPullRequestInput,
  WorkspacePublishStatusInput,
  WorkspacePushInput,
  WorkspaceRecentCommitsResult
} from '../../shared/contracts/workspaces';
import type {
  WorkspaceChange,
  WorkspaceCommitLogEntry,
  WorkspaceDiff,
  WorkspaceDirectoryEntry,
  WorkspaceDirectorySnapshot,
  WorkspacePublishStatus,
  WorkspaceReviewStatus
} from '../../shared/domain/workspace-inspection';
import type { TaskStatus } from '../../shared/domain/task';
import type { AppDatabase } from '../database/client';
import {
  execGit,
  pushGitBranch,
  resolveGitBranchPublishStatus
} from './git-client';
import {
  createWorkspacePullRequest,
  inspectWorkspacePullRequestStatus
} from './github-cli-service';
import { parseWorkspaceChanges } from './workspace-change-parser';
import {
  createWorkspaceRuntime,
  isMissingPathError,
  isNotDirectoryError,
  normalizeNonEmptyRelativePath,
  normalizeRelativePath,
  normalizeWorkspaceError,
  resolveWorkspaceTargetPath
} from './workspace-runtime';

export function createWorkspaceService(
  db: AppDatabase,
  publishWorkspaceInspectionChange?: (taskId: number) => void,
  openExternalUrl?: (url: string) => Promise<void> | void
) {
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

    async listRecentCommits(taskId: number): Promise<WorkspaceRecentCommitsResult> {
      const context = await workspaceRuntime.resolveWorkspaceContext(taskId);
      return listRecentCommits(context.worktreePath);
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

      publishWorkspaceInspectionChange?.(input.taskId);

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
    },

    async getPublishStatus(input: WorkspacePublishStatusInput): Promise<WorkspaceReviewStatus> {
      const context = await workspaceRuntime.resolveWorkspaceContext(input.taskId);
      return resolveWorkspaceReviewStatus(
        context.worktreePath,
        context.worktree,
        context.project.defaultBranch
      );
    },

    async pushBranch(input: WorkspacePushInput): Promise<WorkspaceReviewStatus> {
      const context = await workspaceRuntime.resolveWorkspaceContext(input.taskId);
      const publishStatus = await resolveWorkspacePublishStatus(
        context.worktreePath,
        context.worktree,
        context.project.defaultBranch
      );

      if (!publishStatus.canPush) {
        throw new Error(resolvePushUnavailableMessage(publishStatus));
      }

      try {
        await pushGitBranch(context.worktreePath, publishStatus);
      } catch (error) {
        const message =
          error instanceof Error
            ? normalizePushError(error.message)
            : 'Autocode could not push this branch.';

        throw new Error(message);
      }

      publishWorkspaceInspectionChange?.(input.taskId);

      return resolveWorkspaceReviewStatus(
        context.worktreePath,
        context.worktree,
        context.project.defaultBranch
      );
    },

    async createPullRequest(input: WorkspaceCreatePullRequestInput): Promise<WorkspaceReviewStatus> {
      const context = await workspaceRuntime.resolveWorkspaceContext(input.taskId);
      const publishStatus = await resolveWorkspacePublishStatus(
        context.worktreePath,
        context.worktree,
        context.project.defaultBranch
      );

      const pullRequest = await createWorkspacePullRequest(context.worktreePath, {
        baseBranch: context.project.defaultBranch,
        body: buildPullRequestBody(context.task.title, context.task.description),
        branchName: context.worktree.branchName,
        publishStatus,
        title: context.task.title.trim()
      });

      return {
        publish: publishStatus,
        pullRequest
      };
    },

    async openPullRequest(input: WorkspaceOpenPullRequestInput): Promise<void> {
      const context = await workspaceRuntime.resolveWorkspaceContext(input.taskId);
      const reviewStatus = await resolveWorkspaceReviewStatus(
        context.worktreePath,
        context.worktree,
        context.project.defaultBranch
      );
      const pullRequestUrl = reviewStatus.pullRequest.url;

      if (!pullRequestUrl) {
        throw new Error('This task branch does not have a pull request to open yet.');
      }

      if (!openExternalUrl) {
        throw new Error('Autocode could not open external URLs from this workspace.');
      }

      await openExternalUrl(pullRequestUrl);
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
    worktreePath,
    { trimOutput: false }
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
    worktreePath,
    { trimOutput: false }
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
    isStaged: false,
    linesAdded: null,
    linesRemoved: null,
    previousPath: input.previousPath ?? null,
    relativePath: input.relativePath,
    status: input.status
  };
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

async function listRecentCommits(
  worktreePath: string
): Promise<WorkspaceCommitLogEntry[]> {
  try {
    const output = await execGit(
      ['log', '--oneline', '--format=%H%x00%s%x00%ar', '-n', '10'],
      worktreePath
    );

    if (!output.trim()) {
      return [];
    }

    return output
      .trim()
      .split('\n')
      .map((line) => {
        const [sha, message, relativeTime] = line.split('\0');
        return {
          message: message ?? '',
          relativeTime: relativeTime ?? '',
          sha: sha ?? ''
        };
      })
      .filter((entry) => entry.sha.length > 0);
  } catch {
    return [];
  }
}

function normalizeCommitError(message: string): string {
  if (message.includes('Author identity unknown') || message.includes('Please tell me who you are')) {
    return 'Git user.name and user.email are not configured for commits on this machine.';
  }

  return message;
}

async function resolveWorkspacePublishStatus(
  worktreePath: string,
  worktree: { baseRef: string | null; branchName: string },
  defaultBranch: string | null
): Promise<WorkspacePublishStatus> {
  return resolveGitBranchPublishStatus(worktreePath, {
    baseRef: worktree.baseRef,
    branchName: worktree.branchName,
    defaultBranch
  });
}

async function resolveWorkspaceReviewStatus(
  worktreePath: string,
  worktree: { baseRef: string | null; branchName: string },
  defaultBranch: string | null
): Promise<WorkspaceReviewStatus> {
  const publish = await resolveWorkspacePublishStatus(worktreePath, worktree, defaultBranch);
  const pullRequest = await inspectWorkspacePullRequestStatus(worktreePath, {
    baseBranch: defaultBranch,
    branchName: worktree.branchName,
    publishStatus: publish
  });

  return {
    publish,
    pullRequest
  };
}

function normalizePushError(message: string): string {
  if (
    message.includes('Authentication failed') ||
    message.includes('Repository not found') ||
    message.includes('Permission denied') ||
    message.includes('Could not read from remote repository')
  ) {
    return 'Git could not authenticate with the remote or you do not have access to it.';
  }

  if (
    message.includes('[rejected]') ||
    message.includes('non-fast-forward') ||
    message.includes('fetch first')
  ) {
    return 'The remote branch moved ahead. Pull or rebase this task branch before pushing again.';
  }

  if (
    message.includes('No configured push destination') ||
    message.includes('No such remote')
  ) {
    return 'This repository does not have a Git remote configured for push.';
  }

  return message;
}

function resolvePushUnavailableMessage(status: WorkspacePublishStatus): string {
  switch (status.state) {
    case 'no_remote':
      return 'This repository does not have a Git remote configured for push.';
    case 'unpublished':
      return status.aheadCount > 0
        ? 'This branch is ready to publish.'
        : 'This branch does not have any local commits to push yet.';
    case 'ahead':
      return 'This branch is already ready to push.';
    case 'behind':
      return 'The remote branch is ahead. Pull or rebase this task branch before pushing.';
    case 'diverged':
      return 'This branch diverged from its remote. Pull or rebase before pushing.';
    case 'up_to_date':
      return 'This branch is already up to date on the remote.';
  }
}

function buildPullRequestBody(title: string, description: string | null): string {
  const normalizedDescription = description?.trim() ?? '';

  if (normalizedDescription) {
    return normalizedDescription;
  }

  return `Autocode task: ${title.trim()}`;
}
