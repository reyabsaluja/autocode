import path from 'node:path';
import { mkdirSync } from 'node:fs';

import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { app } from 'electron';

import { bootstrapDatabase } from './bootstrap';
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

  const databasePath = path.join(app.getPath('userData'), 'data', 'autocode.sqlite');
  mkdirSync(path.dirname(databasePath), { recursive: true });

  const sqlite = new Database(databasePath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

  bootstrapDatabase(sqlite);

  databaseContext = {
    db: drizzle(sqlite, { schema }),
    sqlite,
    path: databasePath
  };

  return databaseContext;
}

