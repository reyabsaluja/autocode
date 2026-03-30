import { z } from 'zod';

export const worktreeStatusValues = [
  'provisioning',
  'ready',
  'dirty',
  'archived',
  'failed'
] as const;

export const worktreeStatusSchema = z.enum(worktreeStatusValues);

export const worktreeSchema = z.object({
  id: z.number().int().positive(),
  projectId: z.number().int().positive(),
  taskId: z.number().int().positive(),
  branchName: z.string().min(1),
  worktreePath: z.string().min(1),
  status: worktreeStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export type WorktreeStatus = z.infer<typeof worktreeStatusSchema>;
export type Worktree = z.infer<typeof worktreeSchema>;
