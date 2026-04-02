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

export const workspacePublishStateValues = [
  'no_remote',
  'unpublished',
  'ahead',
  'behind',
  'diverged',
  'up_to_date'
] as const;

export const workspacePublishStateSchema = z.enum(workspacePublishStateValues);

export const workspacePublishStatusSchema = z.object({
  aheadCount: z.number().int().nonnegative(),
  behindCount: z.number().int().nonnegative(),
  branchName: z.string().min(1),
  canPush: z.boolean(),
  defaultBranch: z.string().min(1).nullable(),
  remoteName: z.string().min(1).nullable(),
  state: workspacePublishStateSchema,
  upstreamBranch: z.string().min(1).nullable()
});

export const workspacePullRequestStateValues = [
  'unsupported',
  'auth_required',
  'none',
  'open',
  'merged',
  'closed'
] as const;

export const workspacePullRequestStateSchema = z.enum(workspacePullRequestStateValues);

export const workspacePullRequestStatusSchema = z.object({
  baseBranch: z.string().min(1).nullable(),
  canCreate: z.boolean(),
  headBranch: z.string().min(1),
  isDraft: z.boolean(),
  message: z.string().nullable(),
  number: z.number().int().positive().nullable(),
  state: workspacePullRequestStateSchema,
  url: z.string().min(1).nullable()
});

export const workspaceReviewStatusSchema = z.object({
  publish: workspacePublishStatusSchema,
  pullRequest: workspacePullRequestStatusSchema
});

export type WorkspaceDirectoryEntry = z.infer<typeof workspaceDirectoryEntrySchema>;
export type WorkspaceDirectorySnapshot = z.infer<typeof workspaceDirectorySnapshotSchema>;
export type WorkspaceChangeStatus = z.infer<typeof workspaceChangeStatusSchema>;
export type WorkspaceChange = z.infer<typeof workspaceChangeSchema>;
export type WorkspaceDiff = z.infer<typeof workspaceDiffSchema>;
export type WorkspaceCommitResult = z.infer<typeof workspaceCommitResultSchema>;
export type WorkspaceCommitLogEntry = z.infer<typeof workspaceCommitLogEntrySchema>;
export type WorkspacePublishState = z.infer<typeof workspacePublishStateSchema>;
export type WorkspacePublishStatus = z.infer<typeof workspacePublishStatusSchema>;
export type WorkspacePullRequestState = z.infer<typeof workspacePullRequestStateSchema>;
export type WorkspacePullRequestStatus = z.infer<typeof workspacePullRequestStatusSchema>;
export type WorkspaceReviewStatus = z.infer<typeof workspaceReviewStatusSchema>;
