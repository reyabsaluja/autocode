import { z } from 'zod';

export const workspaceFileDocumentSchema = z.object({
  content: z.string().nullable(),
  isBinary: z.boolean(),
  relativePath: z.string().min(1),
  sizeBytes: z.number().int().nonnegative()
});

export const workspaceFileWriteResultSchema = z.object({
  relativePath: z.string().min(1),
  savedAt: z.string().datetime(),
  sizeBytes: z.number().int().nonnegative()
});

export type WorkspaceFileDocument = z.infer<typeof workspaceFileDocumentSchema>;
export type WorkspaceFileWriteResult = z.infer<typeof workspaceFileWriteResultSchema>;
