import { BrowserWindow, dialog, type IpcMainInvokeEvent, type OpenDialogOptions } from 'electron';

import {
  type AddProjectInput,
  addProjectInputSchema,
  addProjectResultSchema,
  listProjectsResultSchema,
  pickProjectPathResultSchema
} from '../../shared/contracts/projects';
import { projectChannels } from '../../shared/ipc/channels';
import { handleValidatedIpc } from './handle-validated-ipc';
import { createProjectService } from '../services/project-service';

export type ProjectService = ReturnType<typeof createProjectService>;

export function registerProjectHandlers(projectService: ProjectService): void {
  handleValidatedIpc(projectChannels.list, {
    handler: () => projectService.listProjects(),
    outputSchema: listProjectsResultSchema
  });

  handleValidatedIpc(projectChannels.pickPath, {
    handler: async (event) => {
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
    },
    outputSchema: pickProjectPathResultSchema
  });

  handleValidatedIpc(projectChannels.add, {
    handler: async (_event: IpcMainInvokeEvent, input: AddProjectInput) => projectService.addProject(input),
    inputSchema: addProjectInputSchema,
    outputSchema: addProjectResultSchema
  });
}
