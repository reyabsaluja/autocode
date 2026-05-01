import type { IpcMainInvokeEvent } from 'electron';

import {
  type DeleteAgentSessionInput,
  deleteAgentSessionInputSchema,
  deleteAgentSessionResultSchema,
  type ListAgentSessionsByTaskInput,
  listAgentSessionsByTaskInputSchema,
  listAgentSessionsByTaskResultSchema,
  type ReadAgentSessionTranscriptTailInput,
  readAgentSessionTranscriptTailInputSchema,
  readAgentSessionTranscriptTailResultSchema,
  type ResizeAgentSessionInput,
  resizeAgentSessionInputSchema,
  resizeAgentSessionResultSchema,
  type SendAgentSessionInput,
  sendAgentSessionInputSchema,
  sendAgentSessionResultSchema,
  type StartAgentSessionInput,
  startAgentSessionInputSchema,
  startAgentSessionResultSchema
} from '../../shared/contracts/agent-sessions';
import { agentSessionChannels } from '../../shared/ipc/channels';
import { createAgentSessionService } from '../services/agent-session-service';
import { handleValidatedIpc } from './handle-validated-ipc';

export type AgentSessionService = ReturnType<typeof createAgentSessionService>;

export function registerAgentSessionHandlers(agentSessionService: AgentSessionService): void {
  handleValidatedIpc(agentSessionChannels.delete, {
    handler: async (_event: IpcMainInvokeEvent, input: DeleteAgentSessionInput) =>
      agentSessionService.delete(input),
    inputSchema: deleteAgentSessionInputSchema,
    outputSchema: deleteAgentSessionResultSchema
  });

  handleValidatedIpc(agentSessionChannels.listByTask, {
    handler: async (_event: IpcMainInvokeEvent, input: ListAgentSessionsByTaskInput) =>
      agentSessionService.listByTask(input),
    inputSchema: listAgentSessionsByTaskInputSchema,
    outputSchema: listAgentSessionsByTaskResultSchema
  });

  handleValidatedIpc(agentSessionChannels.start, {
    handler: async (_event: IpcMainInvokeEvent, input: StartAgentSessionInput) =>
      agentSessionService.start(input),
    inputSchema: startAgentSessionInputSchema,
    outputSchema: startAgentSessionResultSchema
  });

  handleValidatedIpc(agentSessionChannels.sendInput, {
    handler: async (_event: IpcMainInvokeEvent, input: SendAgentSessionInput) =>
      agentSessionService.sendInput(input),
    inputSchema: sendAgentSessionInputSchema,
    outputSchema: sendAgentSessionResultSchema
  });

  handleValidatedIpc(agentSessionChannels.resize, {
    handler: async (_event: IpcMainInvokeEvent, input: ResizeAgentSessionInput) =>
      agentSessionService.resize(input),
    inputSchema: resizeAgentSessionInputSchema,
    outputSchema: resizeAgentSessionResultSchema
  });

  handleValidatedIpc(agentSessionChannels.readTranscriptTail, {
    handler: async (_event: IpcMainInvokeEvent, input: ReadAgentSessionTranscriptTailInput) =>
      agentSessionService.readTranscriptTail(input),
    inputSchema: readAgentSessionTranscriptTailInputSchema,
    outputSchema: readAgentSessionTranscriptTailResultSchema
  });
}
