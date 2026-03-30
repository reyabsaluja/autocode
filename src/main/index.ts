import path from 'node:path';
import { existsSync } from 'node:fs';

import { app, BrowserWindow } from 'electron';

import { getDatabaseContext } from './database/client';
import { AUTOCODE_APP_NAME } from './database/paths';
import { registerProjectHandlers } from './ipc/register-project-handlers';
import { createProjectService } from './services/project-service';

let mainWindow: BrowserWindow | null = null;

function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1120,
    minHeight: 720,
    show: false,
    backgroundColor: '#0f172a',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: resolvePreloadPath(),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  window.on('ready-to-show', () => {
    window.show();
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    window.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    window.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  return window;
}

async function bootstrap(): Promise<void> {
  const { db } = getDatabaseContext();
  const projectService = createProjectService(db);

  registerProjectHandlers(projectService);

  mainWindow = createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
    }
  });
}

app.setName(AUTOCODE_APP_NAME);
app.whenReady().then(bootstrap);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

function resolvePreloadPath(): string {
  const candidatePaths = [
    path.join(__dirname, '../preload/index.mjs'),
    path.join(__dirname, '../preload/index.js')
  ];

  const preloadPath = candidatePaths.find((candidate) => existsSync(candidate));

  if (!preloadPath) {
    throw new Error(`Unable to locate preload bundle. Checked: ${candidatePaths.join(', ')}`);
  }

  return preloadPath;
}
