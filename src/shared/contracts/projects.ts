import { z } from 'zod';

import { projectSchema } from '../domain/project';

export const projectChannels = {
  list: 'projects:list',
  add: 'projects:add',
  pickPath: 'projects:pickPath'
} as const;

export const listProjectsResultSchema = z.array(projectSchema);

export const addProjectInputSchema = z.object({
  path: z.string().trim().min(1)
});

export type AddProjectInput = z.infer<typeof addProjectInputSchema>;
export type ListProjectsResult = z.infer<typeof listProjectsResultSchema>;

