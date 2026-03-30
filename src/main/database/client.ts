import path from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';

import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

import { resolveAutocodeDatabasePath } from './paths';
import * as schema from './schema';

export type AppDatabase = BetterSQLite3Database<typeof schema>;

export interface DatabaseContext {
  db: AppDatabase;
  sqlite: Database.Database;
  path: string;
}

let databaseContext: DatabaseContext | null = null;

export function getDatabaseContext(): DatabaseContext {
  if (databaseContext) {
    return databaseContext;
  }

  const databasePath = resolveAutocodeDatabasePath();
  mkdirSync(path.dirname(databasePath), { recursive: true });

  const sqlite = new Database(databasePath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('busy_timeout = 5000');

  const db = drizzle(sqlite, { schema });

  migrate(db, {
    migrationsFolder: resolveMigrationsFolder()
  });

  databaseContext = {
    db,
    sqlite,
    path: databasePath
  };

  return databaseContext;
}

function resolveMigrationsFolder(): string {
  const sourceFolder = path.resolve(process.cwd(), 'src/main/database/migrations');
  const bundledFolder = path.join(__dirname, 'migrations');
  const isDevServer = Boolean(process.env.ELECTRON_RENDERER_URL);

  if (isDevServer && existsSync(sourceFolder)) {
    return sourceFolder;
  }

  if (existsSync(bundledFolder)) {
    return bundledFolder;
  }

  if (existsSync(sourceFolder)) {
    return sourceFolder;
  }

  throw new Error(`Unable to locate database migrations. Checked: ${bundledFolder}, ${sourceFolder}`);
}
