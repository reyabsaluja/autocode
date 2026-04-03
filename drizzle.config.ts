import { defineConfig } from 'drizzle-kit';

import { resolveAutocodeDatabasePath } from './src/main/database/paths';

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/main/database/schema.ts',
  out: './src/main/database/migrations',
  dbCredentials: {
    url: resolveAutocodeDatabasePath()
  }
});
