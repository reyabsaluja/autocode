import path from 'node:path';
import { existsSync } from 'node:fs';

import { app, BrowserWindow, dialog } from 'electron';

import { getDatabaseContext } from './database/client';
import { AUTOCODE_APP_NAME } from './database/paths';
import { registerAgentSessionHandlers } from './ipc/register-agent-session-handlers';
import { registerProjectHandlers } from './ipc/register-project-handlers';
import { registerTaskHandlers } from './ipc/register-task-handlers';
import { registerWorkspaceHandlers } from './ipc/register-workspace-handlers';
import { agentSessionChannels } from '../shared/ipc/channels';
import { createAgentSessionService } from './services/agent-session-service';
import { createProjectService } from './services/project-service';
import { createWorkspaceFileService } from './services/workspace-file-service';
import { createTaskService } from './services/task-service';
import { createWorkspaceService } from './services/workspace-service';

let mainWindow: BrowserWindow | null = null;

function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1120,
    minHeight: 720,
    show: false,
    backgroundColor: '#09090b',
    hasShadow: false,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: resolvePreloadPath(),
      // The current IPC bridge depends on a preload environment that remains stable
      // across dev and packaged builds. Re-enable Electron sandboxing once the bridge
      // is adapted and verified there.
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
  const agentSessionService = createAgentSessionService(db, (event) => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send(agentSessionChannels.event, event);
    }
  });
  const taskService = createTaskService(db, {
    deleteByTask: agentSessionService.deleteByTask
  });
  const workspaceService = createWorkspaceService(db);
  const workspaceFileService = createWorkspaceFileService(db);

  await taskService.reconcileProvisioningTaskWorkspaces();
  await agentSessionService.reconcileInterruptedSessions();

  registerAgentSessionHandlers(agentSessionService);
  registerProjectHandlers(projectService);
  registerTaskHandlers(taskService);
  registerWorkspaceHandlers(workspaceService, workspaceFileService);

  mainWindow = createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
    }
  });
}

app.setName(AUTOCODE_APP_NAME);
app.whenReady().then(bootstrap).catch((error) => {
  const message = error instanceof Error ? `${error.message}\n\n${error.stack ?? ''}` : String(error);

  console.error('Failed to bootstrap Autocode', error);
  dialog.showErrorBox('Autocode failed to start', message);
  app.quit();
});

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
