import { z } from 'zod';

import { projectSchema } from '../domain/project';

export const listProjectsResultSchema = z.array(projectSchema);

export const addProjectInputSchema = z.object({
  path: z.string().trim().min(1)
});

export type AddProjectInput = z.infer<typeof addProjectInputSchema>;
export type ListProjectsResult = z.infer<typeof listProjectsResultSchema>;
