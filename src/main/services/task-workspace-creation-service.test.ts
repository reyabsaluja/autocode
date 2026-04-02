import { afterEach, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

import * as schema from '../database/schema';
import { execGit } from './git-client';
import { createTaskWorkspaceCreationService } from './task-workspace-creation-service';

const tempDirectories: string[] = [];
const originalAutocodeDataDir = process.env.AUTOCODE_DATA_DIR;

afterEach(async () => {
  if (originalAutocodeDataDir === undefined) {
    delete process.env.AUTOCODE_DATA_DIR;
  } else {
    process.env.AUTOCODE_DATA_DIR = originalAutocodeDataDir;
  }

  await Promise.all(
    tempDirectories.map((directory) => rm(directory, { force: true, recursive: true }))
  );
  tempDirectories.length = 0;
});

describe('task workspace creation service', () => {
  test('persists the resolved base ref for tasks created from the project default branch', async () => {
    const rootDirectory = await mkdtemp(path.join(os.tmpdir(), 'autocode-task-workspace-creation-'));
    tempDirectories.push(rootDirectory);
    process.env.AUTOCODE_DATA_DIR = rootDirectory;

    const repoPath = path.join(rootDirectory, 'repo');
    await mkdir(repoPath, { recursive: true });

    await execGit(['init'], repoPath);
    await execGit(['config', 'user.name', 'Autocode Tests'], repoPath);
    await execGit(['config', 'user.email', 'autocode@example.com'], repoPath);
    await execGit(['checkout', '-b', 'main'], repoPath);
    await writeFile(path.join(repoPath, 'README.md'), 'initial\n');
    await execGit(['add', 'README.md'], repoPath);
    await execGit(['commit', '-m', 'Initial commit'], repoPath);

    const sqlite = new Database(path.join(rootDirectory, 'test.sqlite'));
    sqlite.pragma('foreign_keys = ON');

    const db = drizzle(sqlite, { schema });

    migrate(db, {
      migrationsFolder: path.resolve(process.cwd(), 'src/main/database/migrations')
    });

    const timestamp = '2026-04-02T12:00:00.000Z';
    const project = db
      .insert(schema.projectsTable)
      .values({
        createdAt: timestamp,
        defaultBranch: 'main',
        gitRoot: repoPath,
        name: 'repo',
        repoPath,
        updatedAt: timestamp
      })
      .returning()
      .get();

    const taskWorkspaceCreationService = createTaskWorkspaceCreationService(db);
    const workspace = await taskWorkspaceCreationService.createTaskWorkspace({
      projectId: project.id,
      title: 'Task A'
    });

    expect(workspace.worktree?.baseRef).toBe('main');
  });
});
