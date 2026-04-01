import { z } from 'zod';

import {
  workspaceFileDocumentSchema,
  workspaceFileWriteResultSchema as workspaceFileWriteDomainResultSchema
} from '../domain/workspace-file';

const taskIdSchema = z.number().int().positive();

export const workspaceFileReadInputSchema = z.object({
  relativePath: z.string().trim().min(1),
  taskId: taskIdSchema
});

export const workspaceFileWriteInputSchema = z.object({
  content: z.string(),
  relativePath: z.string().trim().min(1),
  taskId: taskIdSchema
});

export const workspaceFileReadResultSchema = workspaceFileDocumentSchema;
export const workspaceFileWriteResultSchema = workspaceFileWriteDomainResultSchema;

export type WorkspaceFileReadInput = z.infer<typeof workspaceFileReadInputSchema>;
export type WorkspaceFileWriteInput = z.infer<typeof workspaceFileWriteInputSchema>;
export type WorkspaceFileReadResult = z.infer<typeof workspaceFileReadResultSchema>;
export type WorkspaceFileWriteResult = z.infer<typeof workspaceFileWriteResultSchema>;
