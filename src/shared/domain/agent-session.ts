import { z } from 'zod';

export const agentProviderValues = ['codex', 'claude-code', 'claude-bedrock', 'terminal'] as const;
export const agentSessionSurfaceValues = ['terminal', 'chat'] as const;
export const agentSessionStatusValues = [
  'starting',
  'running',
  'completed',
  'failed',
  'terminated'
] as const;
export const agentSessionTranscriptStreamValues = [
  'stdout',
  'stderr',
  'stdin',
  'system',
  'assistant-delta',
  'assistant-done',
  'thinking',
  'thinking-done',
  'tool-start',
  'tool-update',
  'tool-done',
  'turn-start',
  'turn-done',
  'todo-list'
] as const;

export const agentProviderSchema = z.enum(agentProviderValues);
export const agentSessionSurfaceSchema = z.enum(agentSessionSurfaceValues);
export const agentSessionStatusSchema = z.enum(agentSessionStatusValues);
export const agentSessionTranscriptStreamSchema = z.enum(agentSessionTranscriptStreamValues);

export const agentSessionSchema = z.object({
  id: z.number().int().positive(),
  taskId: z.number().int().positive(),
  worktreeId: z.number().int().positive(),
  provider: agentProviderSchema,
  surface: agentSessionSurfaceSchema,
  command: z.string().min(1),
  title: z.string().nullable(),
  pid: z.number().int().positive().nullable(),
  exitCode: z.number().int().nullable(),
  lastError: z.string().nullable(),
  lastEventSeq: z.number().int().nonnegative(),
  startedAt: z.string().datetime().nullable(),
  endedAt: z.string().datetime().nullable(),
  status: agentSessionStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const agentSessionTranscriptEntrySchema = z.object({
  at: z.string().datetime(),
  itemId: z.string().optional(),
  seq: z.number().int().positive(),
  stream: agentSessionTranscriptStreamSchema,
  text: z.string()
});

export const agentSessionSnapshotEventSchema = z.object({
  session: agentSessionSchema,
  type: z.literal('snapshot')
});

export const agentSessionEntriesEventSchema = z.object({
  entries: z.array(agentSessionTranscriptEntrySchema),
  taskId: z.number().int().positive(),
  sessionId: z.number().int().positive(),
  type: z.literal('entries')
});

export const agentSessionEventSchema = z.discriminatedUnion('type', [
  agentSessionSnapshotEventSchema,
  agentSessionEntriesEventSchema
]);

export type AgentProvider = z.infer<typeof agentProviderSchema>;
export type AgentSessionSurface = z.infer<typeof agentSessionSurfaceSchema>;
export type AgentSessionStatus = z.infer<typeof agentSessionStatusSchema>;
export type AgentSessionTranscriptStream = z.infer<typeof agentSessionTranscriptStreamSchema>;
export type AgentSession = z.infer<typeof agentSessionSchema>;
export type AgentSessionTranscriptEntry = z.infer<typeof agentSessionTranscriptEntrySchema>;
export type AgentSessionSnapshotEvent = z.infer<typeof agentSessionSnapshotEventSchema>;
export type AgentSessionEntriesEvent = z.infer<typeof agentSessionEntriesEventSchema>;
export type AgentSessionEvent = z.infer<typeof agentSessionEventSchema>;
