import { z } from 'zod';

export const workspaceEntryKindValues = ['file', 'directory'] as const;
export const workspaceEntryKindSchema = z.enum(workspaceEntryKindValues);

export const workspaceDirectoryEntrySchema = z.object({
  kind: workspaceEntryKindSchema,
  name: z.string().min(1),
  relativePath: z.string()
});

export const workspaceDirectorySnapshotSchema = z.object({
  entries: z.array(workspaceDirectoryEntrySchema),
  relativePath: z.string()
});

export const workspaceChangeStatusValues = [
  'added',
  'modified',
  'deleted',
  'untracked',
  'renamed'
] as const;

export const workspaceChangeStatusSchema = z.enum(workspaceChangeStatusValues);

export const workspaceChangeSchema = z.object({
  isStaged: z.boolean().optional().default(false),
  linesAdded: z.number().int().nonnegative().nullable().optional().default(null),
  linesRemoved: z.number().int().nonnegative().nullable().optional().default(null),
  previousPath: z.string().nullable(),
  relativePath: z.string().min(1),
  status: workspaceChangeStatusSchema
});

export const workspaceDiffSchema = z.object({
  relativePath: z.string().min(1),
  text: z.string()
});

export const workspaceCommitResultSchema = z.object({
  commitMessage: z.string().min(1),
  commitSha: z.string().min(1),
  taskId: z.number().int().positive()
});

export const workspaceCommitLogEntrySchema = z.object({
  message: z.string(),
  relativeTime: z.string(),
  sha: z.string().min(1)
});

export type WorkspaceDirectoryEntry = z.infer<typeof workspaceDirectoryEntrySchema>;
export type WorkspaceDirectorySnapshot = z.infer<typeof workspaceDirectorySnapshotSchema>;
export type WorkspaceChangeStatus = z.infer<typeof workspaceChangeStatusSchema>;
export type WorkspaceChange = z.infer<typeof workspaceChangeSchema>;
export type WorkspaceDiff = z.infer<typeof workspaceDiffSchema>;
export type WorkspaceCommitResult = z.infer<typeof workspaceCommitResultSchema>;
export type WorkspaceCommitLogEntry = z.infer<typeof workspaceCommitLogEntrySchema>;
