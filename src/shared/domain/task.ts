import { z } from 'zod';

export const taskStatusValues = [
  'draft',
  'ready',
  'in_progress',
  'needs_review',
  'completed',
  'archived',
  'failed'
] as const;

export const taskStatusSchema = z.enum(taskStatusValues);

export const taskSchema = z.object({
  id: z.number().int().positive(),
  projectId: z.number().int().positive(),
  title: z.string().min(1),
  description: z.string().nullable(),
  status: taskStatusSchema,
  lastError: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export type TaskStatus = z.infer<typeof taskStatusSchema>;
export type Task = z.infer<typeof taskSchema>;
