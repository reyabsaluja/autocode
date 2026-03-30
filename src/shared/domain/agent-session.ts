import { z } from 'zod';

export const agentProviderValues = ['codex', 'claude', 'custom'] as const;
export const agentSessionStatusValues = [
  'idle',
  'starting',
  'running',
  'waiting_input',
  'completed',
  'failed',
  'terminated'
] as const;

export const agentProviderSchema = z.enum(agentProviderValues);
export const agentSessionStatusSchema = z.enum(agentSessionStatusValues);

export const agentSessionSchema = z.object({
  id: z.number().int().positive(),
  taskId: z.number().int().positive(),
  worktreeId: z.number().int().positive().nullable(),
  provider: agentProviderSchema,
  status: agentSessionStatusSchema,
  command: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export type AgentProvider = z.infer<typeof agentProviderSchema>;
export type AgentSessionStatus = z.infer<typeof agentSessionStatusSchema>;
export type AgentSession = z.infer<typeof agentSessionSchema>;

