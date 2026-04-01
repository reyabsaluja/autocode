import { z } from 'zod';

import {
  agentSessionEventSchema,
  agentSessionSchema,
  agentSessionTranscriptEntrySchema
} from '../domain/agent-session';

const sessionIdSchema = z.number().int().positive();
const taskIdSchema = z.number().int().positive();
const terminalDimensionSchema = z.number().int().min(1).max(10_000);

export const listAgentSessionsByTaskInputSchema = z.object({
  taskId: taskIdSchema
});

export const startAgentSessionInputSchema = z.object({
  cols: terminalDimensionSchema,
  rows: terminalDimensionSchema,
  taskId: taskIdSchema
});

export const sendAgentSessionInputSchema = z.object({
  sessionId: sessionIdSchema,
  text: z.string().min(1)
});

export const resizeAgentSessionInputSchema = z.object({
  cols: terminalDimensionSchema,
  rows: terminalDimensionSchema,
  sessionId: sessionIdSchema
});

export const terminateAgentSessionInputSchema = z.object({
  sessionId: sessionIdSchema
});

export const deleteAgentSessionInputSchema = z.object({
  sessionId: sessionIdSchema
});

export const readAgentSessionTranscriptTailInputSchema = z.object({
  maxEntries: z.number().int().min(1).max(5_000).default(500),
  sessionId: sessionIdSchema
});

export const agentSessionListSchema = z.array(agentSessionSchema);
export const listAgentSessionsByTaskResultSchema = agentSessionListSchema;
export const startAgentSessionResultSchema = agentSessionSchema;
export const sendAgentSessionResultSchema = z.void();
export const resizeAgentSessionResultSchema = z.void();
export const terminateAgentSessionResultSchema = agentSessionSchema;
export const deleteAgentSessionResultSchema = z.void();
export const readAgentSessionTranscriptTailResultSchema = z.object({
  entries: z.array(agentSessionTranscriptEntrySchema),
  lastEventSeq: z.number().int().nonnegative()
});
export const agentSessionEventResultSchema = agentSessionEventSchema;

export type ListAgentSessionsByTaskInput = z.infer<typeof listAgentSessionsByTaskInputSchema>;
export type StartAgentSessionInput = z.infer<typeof startAgentSessionInputSchema>;
export type SendAgentSessionInput = z.infer<typeof sendAgentSessionInputSchema>;
export type ResizeAgentSessionInput = z.infer<typeof resizeAgentSessionInputSchema>;
export type TerminateAgentSessionInput = z.infer<typeof terminateAgentSessionInputSchema>;
export type DeleteAgentSessionInput = z.infer<typeof deleteAgentSessionInputSchema>;
export type ReadAgentSessionTranscriptTailInput = z.infer<
  typeof readAgentSessionTranscriptTailInputSchema
>;
export type AgentSessionList = z.infer<typeof agentSessionListSchema>;
export type ListAgentSessionsByTaskResult = z.infer<typeof listAgentSessionsByTaskResultSchema>;
export type StartAgentSessionResult = z.infer<typeof startAgentSessionResultSchema>;
export type SendAgentSessionResult = z.infer<typeof sendAgentSessionResultSchema>;
export type ResizeAgentSessionResult = z.infer<typeof resizeAgentSessionResultSchema>;
export type TerminateAgentSessionResult = z.infer<typeof terminateAgentSessionResultSchema>;
export type DeleteAgentSessionResult = z.infer<typeof deleteAgentSessionResultSchema>;
export type ReadAgentSessionTranscriptTailResult = z.infer<
  typeof readAgentSessionTranscriptTailResultSchema
>;
