import { z } from 'zod';

import {
  workspaceChangeSchema,
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
  relativePath: z.string().trim().min(1),
  taskId: taskIdSchema
});

export const workspaceCommitInputSchema = z.object({
  message: z.string().trim().min(1).max(200),
  taskId: taskIdSchema
});

export const workspaceDirectoryResultSchema = workspaceDirectorySnapshotSchema;
export const workspaceChangesResultSchema = z.array(workspaceChangeSchema);
export const workspaceDiffResultSchema = workspaceDiffSchema.nullable();
export const workspaceCommitResultSchema = workspaceCommitDomainResultSchema;

export type WorkspaceDirectoryInput = z.infer<typeof workspaceDirectoryInputSchema>;
export type WorkspaceChangesInput = z.infer<typeof workspaceChangesInputSchema>;
export type WorkspaceDiffInput = z.infer<typeof workspaceDiffInputSchema>;
export type WorkspaceCommitInput = z.infer<typeof workspaceCommitInputSchema>;
export type WorkspaceDirectoryResult = z.infer<typeof workspaceDirectoryResultSchema>;
export type WorkspaceChangesResult = z.infer<typeof workspaceChangesResultSchema>;
export type WorkspaceDiffResult = z.infer<typeof workspaceDiffResultSchema>;
export type WorkspaceCommitResult = z.infer<typeof workspaceCommitResultSchema>;
