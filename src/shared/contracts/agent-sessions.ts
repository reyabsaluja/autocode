import { z } from 'zod';

import {
  agentProviderSchema,
  agentSessionEventSchema,
  agentSessionSchema,
  agentSessionSurfaceSchema,
  agentSessionTranscriptEntrySchema
} from '../domain/agent-session';

const sessionIdSchema = z.number().int().positive();
const taskIdSchema = z.number().int().positive();
const terminalDimensionSchema = z.number().int().min(1).max(10_000);

export const listAgentSessionsByTaskInputSchema = z.object({
  taskId: taskIdSchema
});

export const startAgentSessionInputSchema = z.object({
  awsCredentials: z
    .object({
      accessKeyId: z.string(),
      region: z.string(),
      secretAccessKey: z.string()
    })
    .optional(),
  cols: terminalDimensionSchema,
  customEnvVars: z.string().optional(),
  model: z.string().optional(),
  provider: agentProviderSchema,
  reasoningEffort: z.enum(['low', 'medium', 'high']).optional(),
  rows: terminalDimensionSchema,
  surface: agentSessionSurfaceSchema.default('terminal'),
  taskId: taskIdSchema
});

export const sendAgentSessionInputSchema = z.object({
  sessionId: sessionIdSchema,
  text: z.string().min(1)
});

export const stopAgentSessionInputSchema = z.object({
  sessionId: sessionIdSchema
});

export const resizeAgentSessionInputSchema = z.object({
  cols: terminalDimensionSchema,
  rows: terminalDimensionSchema,
  sessionId: sessionIdSchema
});

export const deleteAgentSessionInputSchema = z.object({
  sessionId: sessionIdSchema
});

export const renameAgentSessionInputSchema = z.object({
  sessionId: sessionIdSchema,
  title: z.string().min(1).max(120)
});

export const readAgentSessionTranscriptTailInputSchema = z.object({
  maxEntries: z.number().int().min(1).max(5_000).default(500),
  sessionId: sessionIdSchema
});

export const agentSessionListSchema = z.array(agentSessionSchema);
export const listAgentSessionsByTaskResultSchema = agentSessionListSchema;
export const startAgentSessionResultSchema = agentSessionSchema;
export const sendAgentSessionResultSchema = z.void();
export const stopAgentSessionResultSchema = z.void();
export const resizeAgentSessionResultSchema = z.void();
export const deleteAgentSessionResultSchema = z.void();
export const renameAgentSessionResultSchema = agentSessionSchema;
export const readAgentSessionTranscriptTailResultSchema = z.object({
  entries: z.array(agentSessionTranscriptEntrySchema),
  lastEventSeq: z.number().int().nonnegative()
});
export const agentSessionEventResultSchema = agentSessionEventSchema;

export type ListAgentSessionsByTaskInput = z.infer<typeof listAgentSessionsByTaskInputSchema>;
export type StartAgentSessionInput = z.infer<typeof startAgentSessionInputSchema>;
export type SendAgentSessionInput = z.infer<typeof sendAgentSessionInputSchema>;
export type StopAgentSessionInput = z.infer<typeof stopAgentSessionInputSchema>;
export type ResizeAgentSessionInput = z.infer<typeof resizeAgentSessionInputSchema>;
export type DeleteAgentSessionInput = z.infer<typeof deleteAgentSessionInputSchema>;
export type RenameAgentSessionInput = z.infer<typeof renameAgentSessionInputSchema>;
export type ReadAgentSessionTranscriptTailInput = z.infer<
  typeof readAgentSessionTranscriptTailInputSchema
>;
export type AgentSessionList = z.infer<typeof agentSessionListSchema>;
export type ListAgentSessionsByTaskResult = z.infer<typeof listAgentSessionsByTaskResultSchema>;
export type StartAgentSessionResult = z.infer<typeof startAgentSessionResultSchema>;
export type SendAgentSessionResult = z.infer<typeof sendAgentSessionResultSchema>;
export type ResizeAgentSessionResult = z.infer<typeof resizeAgentSessionResultSchema>;
export type DeleteAgentSessionResult = z.infer<typeof deleteAgentSessionResultSchema>;
export type ReadAgentSessionTranscriptTailResult = z.infer<
  typeof readAgentSessionTranscriptTailResultSchema
>;
