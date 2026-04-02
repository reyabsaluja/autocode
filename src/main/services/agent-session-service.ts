import { mkdir } from 'node:fs/promises';

import type {
  DeleteAgentSessionInput,
  ListAgentSessionsByTaskInput,
  ReadAgentSessionTranscriptTailInput,
  ReadAgentSessionTranscriptTailResult,
  ResizeAgentSessionInput,
  SendAgentSessionInput,
  StartAgentSessionInput,
  TerminateAgentSessionInput
} from '../../shared/contracts/agent-sessions';
import type { AgentProvider, AgentSession, AgentSessionEvent } from '../../shared/domain/agent-session';
import type { AppDatabase } from '../database/client';
import { resolveAutocodeSessionsRoot } from '../database/paths';
import { createWorkspaceRuntime } from './workspace-runtime';
import { createAgentSessionRepository } from './agent-session-repository';
import {
  buildInitialInputForProvider,
  getAgentProviderCommand,
  getAgentProviderDisplayName,
  resolveAgentProviderRuntime
} from './agent-session-provider';
import { createAgentSessionRuntimeManager } from './agent-session-runtime-manager';
import {
  readAgentSessionTranscriptTail,
  resolveAgentSessionTranscriptPath
} from './agent-session-transcript';

type AgentSessionEventPublisher = (event: AgentSessionEvent) => void;

export function createAgentSessionService(
  db: AppDatabase,
  publishEvent: AgentSessionEventPublisher,
  publishWorkspaceInspectionChange?: (taskId: number) => void
) {
  const agentSessionRepository = createAgentSessionRepository(db);
  const workspaceRuntime = createWorkspaceRuntime(db);
  const sessionsRoot = resolveAutocodeSessionsRoot();
  const runtimeManager = createAgentSessionRuntimeManager({
    agentSessionRepository,
    publishEvent,
    publishWorkspaceInspectionChange
  });

  return {
    async delete(input: DeleteAgentSessionInput): Promise<void> {
      await runtimeManager.deleteSession(input.sessionId);
    },

    async deleteByTask(taskId: number): Promise<void> {
      const sessions = agentSessionRepository.listByTask(taskId);

      for (const session of sessions) {
        await runtimeManager.deleteSession(session.id);
      }
    },

    listByTask(input: ListAgentSessionsByTaskInput): AgentSession[] {
      return agentSessionRepository.listByTask(input.taskId);
    },

    async readTranscriptTail(
      input: ReadAgentSessionTranscriptTailInput
    ): Promise<ReadAgentSessionTranscriptTailResult> {
      const session = agentSessionRepository.findInternalById(input.sessionId);

      if (!session) {
        throw new Error('Agent session could not be found.');
      }

      return readAgentSessionTranscriptTail(session.transcriptPath, input.maxEntries);
    },

    async reconcileInterruptedSessions(): Promise<void> {
      await mkdir(sessionsRoot, { recursive: true });
      await runtimeManager.reconcileInterruptedSessions();
    },

    async resize(input: ResizeAgentSessionInput): Promise<void> {
      await runtimeManager.resizeRuntime(input.sessionId, input.cols, input.rows);
    },

    async sendInput(input: SendAgentSessionInput): Promise<void> {
      await runtimeManager.writeToRuntime(input.sessionId, input.text);
    },

    async start(input: StartAgentSessionInput): Promise<AgentSession> {
      const context = await workspaceRuntime.observeWorkspaceContext(input.taskId);
      const timestamp = new Date().toISOString();
      const command = getAgentProviderCommand(input.provider);
      const placeholderSession = createPendingSession(
        timestamp,
        input.provider,
        input.taskId,
        context.worktree.id,
        command
      );
      const transcriptPath = resolveAgentSessionTranscriptPath(sessionsRoot, placeholderSession.id);

      agentSessionRepository.setTranscriptPath(placeholderSession.id, transcriptPath, timestamp);

      try {
        await runtimeManager.prepareTranscript(transcriptPath);
      } catch (error) {
        const message = 'Autocode could not create the session transcript on disk.';

        await runtimeManager.failPendingSession({
          message,
          sessionId: placeholderSession.id,
          timestamp,
          transcriptPath
        });

        throw error instanceof Error ? new Error(message, { cause: error }) : new Error(message);
      }

      let providerRuntime: Awaited<ReturnType<typeof resolveAgentProviderRuntime>>;

      try {
        providerRuntime = await resolveAgentProviderRuntime(input.provider);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : `Autocode could not prepare ${getAgentProviderDisplayName(input.provider)}.`;

        await runtimeManager.failPendingSession({
          message,
          sessionId: placeholderSession.id,
          timestamp: new Date().toISOString(),
          transcriptPath
        });
        throw new Error(message);
      }

      const { pid } = await runtimeManager.startRuntime({
        cols: input.cols,
        cwd: context.worktreePath,
        env: providerRuntime.env,
        executablePath: providerRuntime.executablePath,
        provider: input.provider,
        rows: input.rows,
        sessionId: placeholderSession.id,
        transcriptPath
      });

      let runningSession: AgentSession;

      try {
        runningSession = agentSessionRepository.markRunning(
          placeholderSession.id,
          pid,
          new Date().toISOString()
        );
      } catch (error) {
        await runtimeManager.failRuntimeSession(placeholderSession.id, error);
        throw error instanceof Error
          ? error
          : new Error('Autocode could not mark the agent session as running.');
      }

      const initialInput = buildInitialInputForProvider(
        input.provider,
        context.task.title,
        context.task.description
      );

      if (initialInput) {
        try {
          await runtimeManager.writeToRuntime(runningSession.id, initialInput);
        } catch (error) {
          await runtimeManager.failRuntimeSession(runningSession.id, error);
          throw error instanceof Error
            ? error
            : new Error(
                `Autocode could not send the initial prompt to ${providerRuntime.displayName}.`
              );
        }
      }

      const session = requireSession(runningSession.id);
      runtimeManager.publishSnapshot(session);

      return session;
    },

    async terminate(input: TerminateAgentSessionInput): Promise<AgentSession> {
      return runtimeManager.terminateSession(input.sessionId);
    }
  };

  function createPendingSession(
    createdAt: string,
    provider: AgentProvider,
    taskId: number,
    worktreeId: number,
    command: string
  ): AgentSession {
    return agentSessionRepository.create({
      command,
      createdAt,
      provider,
      taskId,
      transcriptPath: '',
      worktreeId
    });
  }

  function requireSession(sessionId: number): AgentSession {
    const session = agentSessionRepository.findById(sessionId);

    if (!session) {
      throw new Error('Agent session could not be found.');
    }

    return session;
  }
}
