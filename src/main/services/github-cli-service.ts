import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import type {
  WorkspacePublishStatus,
  WorkspacePullRequestStatus
} from '../../shared/domain/workspace-inspection';

const execFileAsync = promisify(execFile);

interface InspectWorkspacePullRequestStatusInput {
  baseBranch: string | null;
  branchName: string;
  publishStatus: WorkspacePublishStatus;
}

interface CreateWorkspacePullRequestInput extends InspectWorkspacePullRequestStatusInput {
  body: string;
  title: string;
}

interface GitHubPullRequestRecord {
  baseRefName: string;
  headRefName: string;
  isDraft: boolean;
  number: number;
  state: 'CLOSED' | 'MERGED' | 'OPEN';
  url: string;
}

export async function inspectWorkspacePullRequestStatus(
  worktreePath: string,
  input: InspectWorkspacePullRequestStatusInput
): Promise<WorkspacePullRequestStatus> {
  const createReadyStatus = createPullRequestStatus(input);

  if (!shouldInspectPullRequests(input.publishStatus)) {
    return createReadyStatus;
  }

  try {
    const pullRequests = await execGhJson<GitHubPullRequestRecord[]>(
      [
        'pr',
        'list',
        '--head',
        input.branchName,
        '--state',
        'all',
        '--json',
        'number,url,state,isDraft,baseRefName,headRefName'
      ],
      worktreePath
    );
    const matchingPullRequest = selectMatchingPullRequest(pullRequests, input.branchName);

    if (!matchingPullRequest) {
      return createReadyStatus;
    }

    return {
      baseBranch: matchingPullRequest.baseRefName || input.baseBranch,
      canCreate: false,
      headBranch: input.branchName,
      isDraft: matchingPullRequest.isDraft,
      message: formatExistingPullRequestMessage(matchingPullRequest),
      number: matchingPullRequest.number,
      state: mapGhPullRequestState(matchingPullRequest.state),
      url: matchingPullRequest.url
    };
  } catch (error) {
    return normalizePullRequestInspectionError(error, input, createReadyStatus);
  }
}

export async function createWorkspacePullRequest(
  worktreePath: string,
  input: CreateWorkspacePullRequestInput
): Promise<WorkspacePullRequestStatus> {
  const currentStatus = await inspectWorkspacePullRequestStatus(worktreePath, input);

  if (!currentStatus.canCreate) {
    throw new Error(
      currentStatus.message ?? 'This branch is not ready for a pull request yet.'
    );
  }

  try {
    await execGh(
      [
        'pr',
        'create',
        '--base',
        input.baseBranch!,
        '--head',
        input.branchName,
        '--title',
        input.title,
        '--body',
        input.body
      ],
      worktreePath
    );
  } catch (error) {
    const message = normalizePullRequestCreateError(error);

    if (message.includes('already exists')) {
      return inspectWorkspacePullRequestStatus(worktreePath, input);
    }

    throw new Error(message);
  }

  return inspectWorkspacePullRequestStatus(worktreePath, input);
}

async function execGh(args: string[], cwd: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync('gh', args, { cwd });
    return stdout.trim();
  } catch (error) {
    throw createGhCommandError(error);
  }
}

async function execGhJson<T>(args: string[], cwd: string): Promise<T> {
  const output = await execGh(args, cwd);
  return JSON.parse(output || 'null') as T;
}

function selectMatchingPullRequest(
  pullRequests: GitHubPullRequestRecord[],
  branchName: string
): GitHubPullRequestRecord | null {
  const exactMatches = pullRequests.filter((entry) => entry.headRefName === branchName);

  if (exactMatches.length === 0) {
    return null;
  }

  return (
    exactMatches.find((entry) => entry.state === 'OPEN') ??
    exactMatches[0] ??
    null
  );
}

function shouldInspectPullRequests(publishStatus: WorkspacePublishStatus): boolean {
  return (
    Boolean(publishStatus.remoteName) &&
    Boolean(publishStatus.upstreamBranch)
  );
}

function createPullRequestStatus(
  input: InspectWorkspacePullRequestStatusInput
): WorkspacePullRequestStatus {
  const canCreate =
    input.publishStatus.state === 'up_to_date' &&
    Boolean(input.publishStatus.upstreamBranch) &&
    Boolean(input.baseBranch) &&
    input.baseBranch !== input.branchName;

  return {
    baseBranch: input.baseBranch,
    canCreate,
    headBranch: input.branchName,
    isDraft: false,
    message: resolveReadyPullRequestMessage(input, canCreate),
    number: null,
    state: 'none',
    url: null
  };
}

function resolveReadyPullRequestMessage(
  input: InspectWorkspacePullRequestStatusInput,
  canCreate: boolean
): string | null {
  if (!input.baseBranch) {
    return 'This project does not have a default branch configured for pull requests.';
  }

  if (!input.publishStatus.remoteName) {
    return 'Configure a Git remote before creating a pull request.';
  }

  if (!input.publishStatus.upstreamBranch) {
    return 'Push this task branch before creating a pull request.';
  }

  if (input.publishStatus.state === 'ahead' || input.publishStatus.state === 'unpublished') {
    return 'Push the latest branch changes before creating a pull request.';
  }

  if (input.publishStatus.state === 'behind') {
    return 'Update this task branch before creating a pull request.';
  }

  if (input.publishStatus.state === 'diverged') {
    return 'Resolve the branch divergence before creating a pull request.';
  }

  if (!canCreate) {
    return `This branch is not ready to open a pull request into ${input.baseBranch}.`;
  }

  return `Ready to open a pull request into ${input.baseBranch}.`;
}

function formatExistingPullRequestMessage(pullRequest: GitHubPullRequestRecord): string {
  const statusLabel =
    pullRequest.state === 'OPEN'
      ? pullRequest.isDraft
        ? 'Draft PR'
        : 'PR'
      : pullRequest.state === 'MERGED'
        ? 'Merged PR'
        : 'Closed PR';

  return `${statusLabel} #${pullRequest.number} against ${pullRequest.baseRefName}.`;
}

function normalizePullRequestInspectionError(
  error: unknown,
  input: InspectWorkspacePullRequestStatusInput,
  fallback: WorkspacePullRequestStatus
): WorkspacePullRequestStatus {
  const message = error instanceof Error ? error.message : String(error);

  if (
    message.includes('not logged into any GitHub hosts') ||
    message.includes('authentication required') ||
    message.includes('Try authenticating with')
  ) {
    return {
      ...fallback,
      canCreate: false,
      message: 'GitHub authentication is required before Autocode can inspect or create pull requests.',
      state: 'auth_required'
    };
  }

  if (
    message.includes('none of the git remotes configured for this repository point to a known GitHub host') ||
    message.includes('not a GitHub repository')
  ) {
    return {
      ...fallback,
      canCreate: false,
      message: 'Pull requests are only supported for repositories hosted on GitHub.',
      state: 'unsupported'
    };
  }

  if (message.includes('Could not resolve to a Repository')) {
    return {
      ...fallback,
      canCreate: false,
      message: 'GitHub could not access this repository. Check your GitHub authentication and repository access.',
      state: 'auth_required'
    };
  }

  return {
    ...fallback,
    canCreate: false,
    message:
      fallback.message ??
      resolveReadyPullRequestMessage(input, false) ??
      'Autocode could not inspect pull request status for this branch.',
    state: fallback.state
  };
}

function normalizePullRequestCreateError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  if (
    message.includes('not logged into any GitHub hosts') ||
    message.includes('authentication required') ||
    message.includes('Try authenticating with')
  ) {
    return 'GitHub authentication is required before Autocode can create a pull request.';
  }

  if (
    message.includes('none of the git remotes configured for this repository point to a known GitHub host') ||
    message.includes('not a GitHub repository')
  ) {
    return 'Pull requests are only supported for repositories hosted on GitHub.';
  }

  if (message.includes('already exists')) {
    return 'A pull request for this branch already exists.';
  }

  return message || 'Autocode could not create a pull request for this branch.';
}

function mapGhPullRequestState(state: GitHubPullRequestRecord['state']): WorkspacePullRequestStatus['state'] {
  switch (state) {
    case 'OPEN':
      return 'open';
    case 'MERGED':
      return 'merged';
    case 'CLOSED':
      return 'closed';
  }
}

function createGhCommandError(error: unknown): Error {
  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code?: string }).code === 'ENOENT'
  ) {
    return new Error('GitHub CLI is not installed or is not available on PATH.');
  }

  if (error && typeof error === 'object' && 'stderr' in error) {
    const stderr = String((error as { stderr?: string }).stderr ?? '').trim();

    if (stderr) {
      return new Error(stderr);
    }
  }

  return error instanceof Error
    ? error
    : new Error('Autocode could not run the requested GitHub command.');
}
