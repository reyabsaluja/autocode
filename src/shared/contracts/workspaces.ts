import { z } from 'zod';

import { projectSchema } from '../domain/project';
import { taskWorkspaceSchema } from '../domain/task-workspace';
import {
  workspaceChangeSchema,
  workspaceChangeStatusSchema,
  workspaceCommitLogEntrySchema,
  workspaceCommitResultSchema as workspaceCommitDomainResultSchema,
  workspaceDiffSchema,
  workspaceDirectorySnapshotSchema
} from '../domain/workspace-inspection';

const taskIdSchema = z.number().int().positive();

export const workspaceDirectoryInputSchema = z.object({
  relativePath: z.string().optional().default(''),
  taskId: taskIdSchema
});

export const workspaceChangesInputSchema = z.object({
  taskId: taskIdSchema
});

export const workspaceDiffInputSchema = z.object({
  previousPath: z.string().trim().min(1).nullable().optional(),
  relativePath: z.string().trim().min(1),
  status: workspaceChangeStatusSchema.optional(),
  taskId: taskIdSchema
});

export const workspaceCommitInputSchema = z.object({
  message: z.string().trim().min(1).max(200),
  taskId: taskIdSchema
});

export const workspaceCollectionSyncSchema = z.object({
  project: projectSchema,
  taskWorkspace: taskWorkspaceSchema
});

export const workspaceInspectionEventSchema = z.object({
  taskId: taskIdSchema,
  type: z.literal('inspectionChanged')
});

export const workspaceChangesObservationSchema = workspaceCollectionSyncSchema.extend({
  didHealthChange: z.boolean()
});

export const workspaceInspectionEventResultSchema = workspaceInspectionEventSchema;
export const workspaceDirectoryResultSchema = workspaceDirectorySnapshotSchema;
export const workspaceChangesResultSchema = z.object({
  changes: z.array(workspaceChangeSchema),
  commits: z.array(workspaceCommitLogEntrySchema),
  observation: workspaceChangesObservationSchema
});
export const workspaceDiffResultSchema = workspaceDiffSchema.nullable();
export const workspaceCommitResultSchema = workspaceCommitDomainResultSchema.extend({
  project: projectSchema,
  taskWorkspace: taskWorkspaceSchema
});

export type WorkspaceDirectoryInput = z.infer<typeof workspaceDirectoryInputSchema>;
export type WorkspaceChangesInput = z.infer<typeof workspaceChangesInputSchema>;
export type WorkspaceDiffInput = z.infer<typeof workspaceDiffInputSchema>;
export type WorkspaceCommitInput = z.infer<typeof workspaceCommitInputSchema>;
export type WorkspaceCollectionSync = z.infer<typeof workspaceCollectionSyncSchema>;
export type WorkspaceInspectionEvent = z.infer<typeof workspaceInspectionEventSchema>;
export type WorkspaceChangesObservation = z.infer<typeof workspaceChangesObservationSchema>;
export type WorkspaceDirectoryResult = z.infer<typeof workspaceDirectoryResultSchema>;
export type WorkspaceChangesResult = z.infer<typeof workspaceChangesResultSchema>;
export type WorkspaceDiffResult = z.infer<typeof workspaceDiffResultSchema>;
export type WorkspaceCommitResult = z.infer<typeof workspaceCommitResultSchema>;
