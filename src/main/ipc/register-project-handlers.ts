import { BrowserWindow, dialog, ipcMain, type OpenDialogOptions } from 'electron';

import { addProjectInputSchema, projectChannels } from '../../shared/contracts/projects';
import { createProjectService } from '../services/project-service';

export type ProjectService = ReturnType<typeof createProjectService>;

export function registerProjectHandlers(projectService: ProjectService): void {
  ipcMain.handle(projectChannels.list, () => {
    return projectService.listProjects();
  });

  ipcMain.handle(projectChannels.pickPath, async (event) => {
    const ownerWindow = BrowserWindow.fromWebContents(event.sender);
    const options: OpenDialogOptions = {
      buttonLabel: 'Select repository',
      properties: ['openDirectory'],
      title: 'Select a local Git repository'
    };

    try {
      ownerWindow?.focus();

      const result = ownerWindow
        ? await dialog.showOpenDialog(ownerWindow, options)
        : await dialog.showOpenDialog(options);

      if (result.canceled || result.filePaths.length === 0) {
        return null;
      }

      return result.filePaths[0] ?? null;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Autocode could not open the repository picker.';

      throw new Error(`${message} You can still paste a local repository path instead.`);
    }
  });

  ipcMain.handle(projectChannels.add, async (_event, rawInput) => {
    const input = addProjectInputSchema.parse(rawInput);
    return projectService.addProject(input);
  });
}
