import path from 'node:path';
import { cpSync, existsSync, rmSync } from 'node:fs';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';

function copyDatabaseMigrationsPlugin() {
  return {
    closeBundle() {
      const sourceDir = path.resolve(__dirname, 'src/main/database/migrations');
      const targetDir = path.resolve(__dirname, 'out/main/migrations');

      if (!existsSync(sourceDir)) {
        return;
      }

      rmSync(targetDir, { recursive: true, force: true });
      cpSync(sourceDir, targetDir, { recursive: true });
    },
    name: 'copy-database-migrations'
  };
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin(), copyDatabaseMigrationsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    publicDir: path.resolve(__dirname, 'src/renderer/public'),
    resolve: {
      alias: {
        '@renderer': path.resolve(__dirname, 'src/renderer/src'),
        '@shared': path.resolve(__dirname, 'src/shared')
      }
    },
    plugins: [react()]
  }
});
