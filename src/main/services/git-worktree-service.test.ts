import { afterEach, describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

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
        'autocode/task-1-demo',
        worktreePath
      )
    ).resolves.toBeUndefined();

    expect(existsSync(path.join(worktreePath, 'notes.txt'))).toBe(false);
    expect(existsSync(worktreePath)).toBe(false);
  });
});
