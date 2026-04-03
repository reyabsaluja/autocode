import { z } from 'zod';

export const projectSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1),
  repoPath: z.string().min(1),
  gitRoot: z.string().min(1),
  defaultBranch: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export type Project = z.infer<typeof projectSchema>;

