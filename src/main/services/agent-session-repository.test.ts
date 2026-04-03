import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

import { projectsTable, tasksTable, worktreesTable } from '../database/schema';
import { createAgentSessionRepository } from './agent-session-repository';

const tempDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirectories.map((directory) => rm(directory, { force: true, recursive: true }))
  );
  tempDirectories.length = 0;
});

describe('agent session repository', () => {
  test('enforces one active session per task at the database level', async () => {
    const db = await createMigratedTestDatabase();
    const timestamp = '2026-04-02T12:00:00.000Z';

    const project = db
      .insert(projectsTable)
      .values({
        createdAt: timestamp,
        defaultBranch: 'main',
        gitRoot: '/tmp/autocode-test-repo',
        name: 'autocode-test-repo',
        repoPath: '/tmp/autocode-test-repo',
        updatedAt: timestamp
      })
      .returning()
      .get();

    const task = db
      .insert(tasksTable)
      .values({
        createdAt: timestamp,
        description: null,
        lastError: null,
        projectId: project.id,
        status: 'ready',
        statusBeforeFailure: null,
        title: 'Task A',
        updatedAt: timestamp
      })
      .returning()
      .get();

    const worktree = db
      .insert(worktreesTable)
      .values({
        baseRef: 'main',
        branchName: 'autocode/task-a',
        createdAt: timestamp,
        projectId: project.id,
        status: 'ready',
        taskId: task.id,
        updatedAt: timestamp,
        worktreePath: '/tmp/autocode-test-repo/.autocode/task-a'
      })
      .returning()
      .get();

    const repository = createAgentSessionRepository(db);

    repository.create({
      command: 'codex',
      createdAt: timestamp,
      provider: 'codex',
      taskId: task.id,
      transcriptPath: '/tmp/session-1.ndjson',
      worktreeId: worktree.id
    });

    expect(() =>
      repository.create({
        command: 'claude',
        createdAt: '2026-04-02T12:00:01.000Z',
        provider: 'claude-code',
        taskId: task.id,
        transcriptPath: '/tmp/session-2.ndjson',
        worktreeId: worktree.id
      })
    ).toThrow(/agent_sessions_task_id_active_unique/);
  });
});

async function createMigratedTestDatabase() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'autocode-agent-session-repository-'));
  tempDirectories.push(directory);

  const sqlite = new Database(path.join(directory, 'test.sqlite'));
  sqlite.pragma('foreign_keys = ON');

  const db = drizzle(sqlite, {
    schema: {
      projectsTable,
      tasksTable,
      worktreesTable
    }
  });

  migrate(db, {
    migrationsFolder: path.resolve(process.cwd(), 'src/main/database/migrations')
  });

  return db;
}
