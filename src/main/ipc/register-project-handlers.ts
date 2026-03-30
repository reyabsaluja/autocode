import { dialog, ipcMain } from 'electron';

import { addProjectInputSchema, projectChannels } from '../../shared/contracts/projects';
import { createProjectService } from '../services/project-service';

export type ProjectService = ReturnType<typeof createProjectService>;

export function registerProjectHandlers(projectService: ProjectService): void {
  ipcMain.handle(projectChannels.list, () => {
    return projectService.listProjects();
  });

  ipcMain.handle(projectChannels.pickPath, async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select a local Git repository',
      properties: ['openDirectory', 'createDirectory']
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0] ?? null;
  });

  ipcMain.handle(projectChannels.add, async (_event, rawInput) => {
    const input = addProjectInputSchema.parse(rawInput);
    return projectService.addProject(input);
  });
}

