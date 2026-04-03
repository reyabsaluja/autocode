import { afterEach, describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { execGit } from './git-client';
import { createGitWorktreeService } from './git-worktree-service';

let tempDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirectories.map((directory) => rm(directory, { force: true, recursive: true }))
  );
  tempDirectories = [];
});

describe('git worktree service cleanup', () => {
  test('removes the task worktree when the repository root is already missing', async () => {
    const rootDirectory = await mkdtemp(path.join(os.tmpdir(), 'autocode-worktree-cleanup-'));
    tempDirectories.push(rootDirectory);

    const missingGitRoot = path.join(rootDirectory, 'missing-repo');
    const worktreePath = path.join(rootDirectory, 'task-worktree');

    await mkdir(worktreePath, { recursive: true });
    await writeFile(path.join(worktreePath, 'notes.txt'), 'workspace state');

    const gitWorktreeService = createGitWorktreeService();

    await expect(
      gitWorktreeService.cleanupTaskWorktree(
        {
          createdAt: '2026-04-02T12:00:00.000Z',
          defaultBranch: 'main',
          gitRoot: missingGitRoot,
          id: 1,
          name: 'demo',
          repoPath: missingGitRoot,
          updatedAt: '2026-04-02T12:00:00.000Z'
        },
        'autocode/demo',
        worktreePath
      )
    ).resolves.toBeUndefined();

    expect(existsSync(path.join(worktreePath, 'notes.txt'))).toBe(false);
    expect(existsSync(worktreePath)).toBe(false);
  });

  test('plans clean branch names from the task title', () => {
    const gitWorktreeService = createGitWorktreeService();

    expect(gitWorktreeService.planTaskWorktree(1, 15, 'Task C').branchName).toBe('autocode/task-15-task-c');
  });

  test('uses the task id to avoid aliasing branches across tasks with the same title', () => {
    const gitWorktreeService = createGitWorktreeService();

    expect(gitWorktreeService.planTaskWorktree(1, 15, 'Task C').branchName).not.toBe(
      gitWorktreeService.planTaskWorktree(1, 16, 'Task C').branchName
    );
  });

  test('creates a fresh suffixed branch when the planned branch name already exists', async () => {
    const rootDirectory = await mkdtemp(path.join(os.tmpdir(), 'autocode-worktree-branch-collision-'));
    tempDirectories.push(rootDirectory);

    const repoPath = path.join(rootDirectory, 'repo');
    const worktreePath = path.join(rootDirectory, 'task-worktree');
    await mkdir(repoPath, { recursive: true });

    await execGit(['init'], repoPath);
    await execGit(['config', 'user.name', 'Autocode Tests'], repoPath);
    await execGit(['config', 'user.email', 'autocode@example.com'], repoPath);
    await execGit(['checkout', '-b', 'main'], repoPath);
    await writeFile(path.join(repoPath, 'README.md'), 'initial\n');
    await execGit(['add', 'README.md'], repoPath);
    await execGit(['commit', '-m', 'Initial commit'], repoPath);

    await execGit(['checkout', '-b', 'autocode/task-15-task-c'], repoPath);
    await writeFile(path.join(repoPath, 'stale.txt'), 'stale branch state\n');
    await execGit(['add', 'stale.txt'], repoPath);
    await execGit(['commit', '-m', 'Stale branch commit'], repoPath);
    await execGit(['checkout', 'main'], repoPath);

    const gitWorktreeService = createGitWorktreeService();
    const provisionedWorktree = await gitWorktreeService.createTaskWorktree({
      plannedWorktree: {
        baseRef: 'main',
        branchName: 'autocode/task-15-task-c',
        worktreePath
      },
      project: {
        createdAt: '2026-04-02T12:00:00.000Z',
        defaultBranch: 'main',
        gitRoot: repoPath,
        id: 1,
        name: 'demo',
        repoPath,
        updatedAt: '2026-04-02T12:00:00.000Z'
      },
      task: {
        createdAt: '2026-04-02T12:00:00.000Z',
        description: null,
        id: 15,
        lastError: null,
        projectId: 1,
        status: 'draft',
        statusBeforeFailure: null,
        title: 'Task C',
        updatedAt: '2026-04-02T12:00:00.000Z'
      }
    });

    expect(provisionedWorktree.branchName).toBe('autocode/task-15-task-c-2');
    expect(await execGit(['branch', '--show-current'], worktreePath)).toBe('autocode/task-15-task-c-2');
    expect(existsSync(path.join(worktreePath, 'stale.txt'))).toBe(false);
  });

  test('reads the actual checked out branch when reusing an existing registered worktree', async () => {
    const rootDirectory = await mkdtemp(path.join(os.tmpdir(), 'autocode-worktree-recovery-branch-'));
    tempDirectories.push(rootDirectory);

    const repoPath = path.join(rootDirectory, 'repo');
    const worktreePath = path.join(rootDirectory, 'task-worktree');
    await mkdir(repoPath, { recursive: true });

    await execGit(['init'], repoPath);
    await execGit(['config', 'user.name', 'Autocode Tests'], repoPath);
    await execGit(['config', 'user.email', 'autocode@example.com'], repoPath);
    await execGit(['checkout', '-b', 'main'], repoPath);
    await writeFile(path.join(repoPath, 'README.md'), 'initial\n');
    await execGit(['add', 'README.md'], repoPath);
    await execGit(['commit', '-m', 'Initial commit'], repoPath);

    await execGit(['checkout', '-b', 'autocode/task-15-task-c'], repoPath);
    await writeFile(path.join(repoPath, 'stale.txt'), 'stale branch state\n');
    await execGit(['add', 'stale.txt'], repoPath);
    await execGit(['commit', '-m', 'Stale branch commit'], repoPath);
    await execGit(['checkout', 'main'], repoPath);

    const gitWorktreeService = createGitWorktreeService();
    const plannedWorktree = {
      baseRef: 'main',
      branchName: 'autocode/task-15-task-c',
      worktreePath
    } as const;
    const project = {
      createdAt: '2026-04-02T12:00:00.000Z',
      defaultBranch: 'main',
      gitRoot: repoPath,
      id: 1,
      name: 'demo',
      repoPath,
      updatedAt: '2026-04-02T12:00:00.000Z'
    } as const;
    const task = {
      createdAt: '2026-04-02T12:00:00.000Z',
      description: null,
      id: 15,
      lastError: null,
      projectId: 1,
      status: 'draft',
      statusBeforeFailure: null,
      title: 'Task C',
      updatedAt: '2026-04-02T12:00:00.000Z'
    } as const;

    const initialProvision = await gitWorktreeService.createTaskWorktree({
      plannedWorktree,
      project,
      task
    });

    expect(initialProvision.branchName).toBe('autocode/task-15-task-c-2');
    expect(await execGit(['branch', '--show-current'], worktreePath)).toBe('autocode/task-15-task-c-2');

    const recoveredProvision = await gitWorktreeService.createTaskWorktree({
      plannedWorktree,
      project,
      task
    });

    expect(recoveredProvision.created).toBe(false);
    expect(recoveredProvision.branchName).toBe('autocode/task-15-task-c-2');
  });
});
