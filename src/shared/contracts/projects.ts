import { z } from 'zod';

import { projectSchema } from '../domain/project';

export const listProjectsResultSchema = z.array(projectSchema);
export const pickProjectPathResultSchema = z.string().nullable();

export const addProjectInputSchema = z.object({
  path: z.string().trim().min(1)
});
export const addProjectResultSchema = projectSchema;

export type AddProjectInput = z.infer<typeof addProjectInputSchema>;
export type AddProjectResult = z.infer<typeof addProjectResultSchema>;
export type ListProjectsResult = z.infer<typeof listProjectsResultSchema>;
export type PickProjectPathResult = z.infer<typeof pickProjectPathResultSchema>;
