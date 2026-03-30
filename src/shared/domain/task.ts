import { z } from 'zod';

export const taskStatusValues = [
  'draft',
  'queued',
  'running',
  'review',
  'completed',
  'failed',
  'cancelled'
] as const;

export const taskStatusSchema = z.enum(taskStatusValues);

export const taskSchema = z.object({
  id: z.number().int().positive(),
  projectId: z.number().int().positive(),
  title: z.string().min(1),
  description: z.string().nullable(),
  status: taskStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export type TaskStatus = z.infer<typeof taskStatusSchema>;
export type Task = z.infer<typeof taskSchema>;

