import type Database from 'better-sqlite3';

export function bootstrapDatabase(sqlite: Database.Database): void {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      repo_path TEXT NOT NULL UNIQUE,
      git_root TEXT NOT NULL UNIQUE,
      default_branch TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL CHECK (
        status IN ('draft', 'queued', 'running', 'review', 'completed', 'failed', 'cancelled')
      ),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS tasks_project_id_idx ON tasks(project_id);
    CREATE INDEX IF NOT EXISTS tasks_status_idx ON tasks(status);
  `);
}

