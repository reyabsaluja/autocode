import path from 'node:path';
import { execFile } from 'node:child_process';
import { realpath, stat } from 'node:fs/promises';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface GitRepositoryMetadata {
  defaultBranch: string | null;
  gitRoot: string;
  name: string;
}

interface ExecGitOptions {
  allowedExitCodes?: number[];
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
  try {
    const { stdout } = await execFileAsync('git', ['-C', gitRoot, ...args]);
    return stdout.trim();
  } catch (error) {
    if (isAllowedExitCode(error, options.allowedExitCodes ?? [])) {
      return extractCommandStdout(error).trim();
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

export async function listRegisteredWorktrees(gitRoot: string): Promise<Set<string>> {
  const output = await execGit(['worktree', 'list', '--porcelain'], gitRoot);
  const worktreePaths = new Set<string>();

  for (const line of output.split('\n')) {
    if (!line.startsWith('worktree ')) {
      continue;
    }

    worktreePaths.add(line.slice('worktree '.length));
  }

  return worktreePaths;
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

async function resolveDefaultBranch(gitRoot: string): Promise<string | null> {
  const branchCandidates = [
    await tryExecGit(['symbolic-ref', 'refs/remotes/origin/HEAD', '--short'], gitRoot),
    await tryExecGit(['branch', '--show-current'], gitRoot)
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
