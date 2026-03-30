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

export async function resolveGitRepository(candidatePath: string): Promise<GitRepositoryMetadata> {
  const resolvedInput = await realpath(path.resolve(candidatePath));
  const stats = await stat(resolvedInput);

  if (!stats.isDirectory()) {
    throw new Error('Selected path is not a directory.');
  }

  const gitRoot = await resolveGitRoot(resolvedInput);

  return {
    defaultBranch: await resolveDefaultBranch(gitRoot),
    gitRoot,
    name: path.basename(gitRoot)
  };
}

export async function execGit(args: string[], gitRoot: string): Promise<string> {
  const { stdout } = await execFileAsync('git', ['-C', gitRoot, ...args]);
  return stdout.trim();
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
