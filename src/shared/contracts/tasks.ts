import { z } from 'zod';

import { projectSchema } from '../domain/project';
import { taskTransitionTargetSchema } from '../domain/task';
import { taskWorkspaceSchema } from '../domain/task-workspace';

export const createTaskInputSchema = z.object({
  projectId: z.number().int().positive(),
  baseTaskId: z.number().int().positive().optional(),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(4000).optional().transform((value) => {
    if (!value) {
      return null;
    }

    return value.length > 0 ? value : null;
  })
});

export const listTasksByProjectInputSchema = z.object({
  projectId: z.number().int().positive()
});

export const deleteTaskInputSchema = z.object({
  taskId: z.number().int().positive()
});

export const updateTaskStatusInputSchema = z.object({
  status: taskTransitionTargetSchema,
  taskId: z.number().int().positive()
});

export const taskWorkspaceCollectionSyncSchema = z.object({
  project: projectSchema,
  taskWorkspace: taskWorkspaceSchema
});

export const taskWorkspaceListSchema = z.array(taskWorkspaceSchema);
export const listTasksByProjectResultSchema = taskWorkspaceListSchema;
export const createTaskResultSchema = taskWorkspaceSchema;
export const deleteTaskResultSchema = z.void();
export const updateTaskStatusResultSchema = taskWorkspaceCollectionSyncSchema;

export type CreateTaskInput = z.infer<typeof createTaskInputSchema>;
export type CreateTaskResult = z.infer<typeof createTaskResultSchema>;
export type DeleteTaskInput = z.infer<typeof deleteTaskInputSchema>;
export type DeleteTaskResult = z.infer<typeof deleteTaskResultSchema>;
export type ListTasksByProjectInput = z.infer<typeof listTasksByProjectInputSchema>;
export type ListTasksByProjectResult = z.infer<typeof listTasksByProjectResultSchema>;
export type TaskWorkspaceList = z.infer<typeof taskWorkspaceListSchema>;
export type TaskWorkspaceCollectionSync = z.infer<typeof taskWorkspaceCollectionSyncSchema>;
export type UpdateTaskStatusInput = z.infer<typeof updateTaskStatusInputSchema>;
export type UpdateTaskStatusResult = z.infer<typeof updateTaskStatusResultSchema>;
