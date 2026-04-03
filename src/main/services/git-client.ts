import path from 'node:path';
import { execFile } from 'node:child_process';
import { realpath, stat } from 'node:fs/promises';
import { promisify } from 'node:util';

import type { WorkspacePublishStatus } from '../../shared/domain/workspace-inspection';

const execFileAsync = promisify(execFile);

export interface GitRepositoryMetadata {
  defaultBranch: string | null;
  gitRoot: string;
  name: string;
}

interface ExecGitOptions {
  allowedExitCodes?: number[];
  trimOutput?: boolean;
}

interface ResolveGitBranchPublishStatusInput {
  baseRef: string | null;
  branchName: string;
  defaultBranch: string | null;
}

export async function resolveGitRepository(candidatePath: string): Promise<GitRepositoryMetadata> {
  const resolvedInput = await resolveExistingDirectory(candidatePath);

  const gitRoot = await resolveGitRoot(resolvedInput);

  return {
    defaultBranch: await resolveDefaultBranch(gitRoot),
    gitRoot,
    name: path.basename(gitRoot)
  };
}

export async function execGit(args: string[], gitRoot: string, options: ExecGitOptions = {}): Promise<string> {
  const trimOutput = options.trimOutput ?? true;

  try {
    const { stdout } = await execFileAsync('git', ['-C', gitRoot, ...args]);
    return trimOutput ? stdout.trim() : stdout;
  } catch (error) {
    if (isAllowedExitCode(error, options.allowedExitCodes ?? [])) {
      const stdout = extractCommandStdout(error);
      return trimOutput ? stdout.trim() : stdout;
    }

    throw createGitCommandError(error);
  }
}

export async function gitRefExists(gitRoot: string, ref: string): Promise<boolean> {
  try {
    await execGit(['rev-parse', '--verify', ref], gitRoot);
    return true;
  } catch {
    return false;
  }
}

export async function resolveCheckedOutGitBranch(gitRoot: string): Promise<string> {
  const branchName = await execGit(['branch', '--show-current'], gitRoot);

  if (!branchName) {
    throw new Error('Git worktree is not currently attached to a local branch.');
  }

  return branchName;
}

export async function listRegisteredWorktrees(gitRoot: string): Promise<Set<string>> {
  const records = await listRegisteredWorktreeRecords(gitRoot);
  return new Set(records.map((record) => record.path));
}

export async function resolveGitBranchPublishStatus(
  gitRoot: string,
  input: ResolveGitBranchPublishStatusInput
): Promise<WorkspacePublishStatus> {
  const upstreamBranch = await tryExecGit(
    ['rev-parse', '--abbrev-ref', '--symbolic-full-name', `${input.branchName}@{upstream}`],
    gitRoot
  );
  const remotes = await listGitRemotes(gitRoot);
  const remoteName = resolvePreferredPushRemote(remotes, upstreamBranch);

  if (!remoteName) {
    return {
      aheadCount: 0,
      behindCount: 0,
      branchName: input.branchName,
      canPush: false,
      defaultBranch: input.defaultBranch,
      remoteName: null,
      state: 'no_remote',
      upstreamBranch: null
    };
  }

  if (!upstreamBranch) {
    const aheadCount = await resolveLocalAheadCountWithoutUpstream(gitRoot, input);

    return {
      aheadCount,
      behindCount: 0,
      branchName: input.branchName,
      canPush: aheadCount > 0,
      defaultBranch: input.defaultBranch,
      remoteName,
      state: 'unpublished',
      upstreamBranch: null
    };
  }

  const { aheadCount, behindCount } = await resolveAheadBehindCounts(gitRoot, upstreamBranch);
  const state = resolvePublishState(aheadCount, behindCount);

  return {
    aheadCount,
    behindCount,
    branchName: input.branchName,
    canPush: state === 'ahead',
    defaultBranch: input.defaultBranch,
    remoteName,
    state,
    upstreamBranch
  };
}

export async function pushGitBranch(
  gitRoot: string,
  input: Pick<WorkspacePublishStatus, 'branchName' | 'remoteName' | 'upstreamBranch'>
): Promise<void> {
  if (!input.remoteName) {
    throw new Error('This repository does not have a Git remote configured for push.');
  }

  if (input.upstreamBranch) {
    await execGit(['push'], gitRoot);
    return;
  }

  await execGit(['push', '--set-upstream', input.remoteName, input.branchName], gitRoot);
}

async function resolveGitRoot(candidatePath: string): Promise<string> {
  try {
    const gitRoot = await execGit(['rev-parse', '--show-toplevel'], candidatePath);
    return realpath(gitRoot);
  } catch (error) {
    throw new Error('Selected folder is not inside a Git repository.', {
      cause: error
    });
  }
}

async function listGitRemotes(gitRoot: string): Promise<string[]> {
  try {
    const output = await execGit(['remote'], gitRoot);

    if (!output) {
      return [];
    }

    return output
      .split('\n')
      .map((entry) => entry.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function resolveDefaultBranch(gitRoot: string): Promise<string | null> {
  const branchCandidates = [
    await tryExecGit(['symbolic-ref', 'refs/remotes/origin/HEAD', '--short'], gitRoot),
    await tryResolveCheckedOutGitBranch(gitRoot)
  ]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.replace(/^origin\//, ''));

  return branchCandidates[0] ?? null;
}

async function tryExecGit(args: string[], gitRoot: string): Promise<string | null> {
  try {
    return await execGit(args, gitRoot);
  } catch {
    return null;
  }
}

async function tryResolveCheckedOutGitBranch(gitRoot: string): Promise<string | null> {
  try {
    return await resolveCheckedOutGitBranch(gitRoot);
  } catch {
    return null;
  }
}

async function listRegisteredWorktreeRecords(
  gitRoot: string
): Promise<Array<{ branchName: string | null; path: string }>> {
  const output = await execGit(['worktree', 'list', '--porcelain'], gitRoot);
  const records: Array<{ branchName: string | null; path: string }> = [];
  let currentPath: string | null = null;
  let currentBranchName: string | null = null;

  for (const line of output.split('\n')) {
    if (line.startsWith('worktree ')) {
      if (currentPath) {
        records.push({
          branchName: currentBranchName,
          path: currentPath
        });
      }

      currentPath = await resolveRegisteredWorktreePath(line.slice('worktree '.length));
      currentBranchName = null;
      continue;
    }

    if (line.startsWith('branch ') && currentPath) {
      currentBranchName = line
        .slice('branch '.length)
        .replace(/^refs\/heads\//, '')
        .trim();
    }
  }

  if (currentPath) {
    records.push({
      branchName: currentBranchName,
      path: currentPath
    });
  }

  return records;
}

async function resolveRegisteredWorktreePath(worktreePath: string): Promise<string> {
  try {
    return await realpath(worktreePath);
  } catch {
    return path.resolve(worktreePath);
  }
}

async function resolveAheadBehindCounts(
  gitRoot: string,
  upstreamBranch: string
): Promise<{ aheadCount: number; behindCount: number }> {
  const output = await execGit(
    ['rev-list', '--left-right', '--count', `${upstreamBranch}...HEAD`],
    gitRoot
  );
  const [behind, ahead] = output.split('\t');

  return {
    aheadCount: parseGitCount(ahead),
    behindCount: parseGitCount(behind)
  };
}

async function resolveLocalAheadCountWithoutUpstream(
  gitRoot: string,
  input: ResolveGitBranchPublishStatusInput
): Promise<number> {
  const comparisonRef = await resolveLocalComparisonRef(gitRoot, input);

  if (!comparisonRef) {
    return 0;
  }

  const output = await execGit(['rev-list', '--count', `${comparisonRef}..HEAD`], gitRoot);
  return parseGitCount(output);
}

async function resolveLocalComparisonRef(
  gitRoot: string,
  input: ResolveGitBranchPublishStatusInput
): Promise<string | null> {
  const candidates = [
    input.baseRef,
    input.defaultBranch ? `origin/${input.defaultBranch}` : null,
    input.defaultBranch
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    if (await gitRefExists(gitRoot, candidate)) {
      return candidate;
    }
  }

  return null;
}

function resolvePreferredPushRemote(
  remotes: string[],
  upstreamBranch: string | null
): string | null {
  if (upstreamBranch) {
    const [remoteName] = upstreamBranch.split('/');
    return remoteName || null;
  }

  if (remotes.includes('origin')) {
    return 'origin';
  }

  return remotes[0] ?? null;
}

function resolvePublishState(
  aheadCount: number,
  behindCount: number
): WorkspacePublishStatus['state'] {
  if (aheadCount > 0 && behindCount > 0) {
    return 'diverged';
  }

  if (behindCount > 0) {
    return 'behind';
  }

  if (aheadCount > 0) {
    return 'ahead';
  }

  return 'up_to_date';
}

function parseGitCount(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? '0', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

async function resolveExistingDirectory(candidatePath: string): Promise<string> {
  const absolutePath = path.resolve(candidatePath);

  try {
    const resolvedPath = await realpath(absolutePath);
    const stats = await stat(resolvedPath);

    if (!stats.isDirectory()) {
      throw new Error('Selected path is not a directory.');
    }

    return resolvedPath;
  } catch (error) {
    if (isMissingPathError(error)) {
      throw new Error('Selected path does not exist.');
    }

    if (error instanceof Error && error.message === 'Selected path is not a directory.') {
      throw error;
    }

    throw new Error('Autocode could not inspect the selected path.', {
      cause: error
    });
  }
}

function createGitCommandError(error: unknown): Error {
  if (isMissingGitBinaryError(error)) {
    return new Error('Git is not installed or is not available on PATH.');
  }

  const stderr = extractCommandStderr(error);

  if (stderr) {
    return new Error(stderr);
  }

  const stdout = extractCommandStdout(error).trim();

  if (stdout) {
    return new Error(stdout);
  }

  return error instanceof Error ? error : new Error('Autocode could not run the requested Git command.');
}

function isMissingGitBinaryError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: string }).code === 'ENOENT'
  );
}

function isMissingPathError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: string }).code === 'ENOENT'
  );
}

function isAllowedExitCode(error: unknown, allowedExitCodes: number[]): boolean {
  if (!error || typeof error !== 'object' || !('code' in error)) {
    return false;
  }

  const code = (error as { code?: number | string }).code;
  return typeof code === 'number' && allowedExitCodes.includes(code);
}

function extractCommandStdout(error: unknown): string {
  if (error && typeof error === 'object' && 'stdout' in error) {
    return String((error as { stdout?: string }).stdout ?? '');
  }

  return '';
}

function extractCommandStderr(error: unknown): string {
  if (error && typeof error === 'object' && 'stderr' in error) {
    return String((error as { stderr?: string }).stderr ?? '').trim();
  }

  return '';
}
