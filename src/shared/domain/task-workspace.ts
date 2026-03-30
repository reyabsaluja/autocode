import { z } from 'zod';

import { taskSchema } from './task';
import { worktreeSchema } from './worktree';

export const taskWorkspaceSchema = z.object({
  task: taskSchema,
  worktree: worktreeSchema.nullable()
});

export type TaskWorkspace = z.infer<typeof taskWorkspaceSchema>;

