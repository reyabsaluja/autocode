import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';

import type {
  DeleteAgentSessionInput,
  ListAgentSessionsByTaskInput,
  ReadAgentSessionTranscriptTailInput,
  ReadAgentSessionTranscriptTailResult,
  RenameAgentSessionInput,
  ResizeAgentSessionInput,
  SendAgentSessionInput,
  SetSystemPromptInput,
  StartAgentSessionInput,
  StopAgentSessionInput
} from '../../shared/contracts/agent-sessions';
import type { PermissionResponse } from '../../shared/domain/permissions';
import type {
  AgentProvider,
  AgentSession,
  AgentSessionEvent,
  AgentSessionSurface
} from '../../shared/domain/agent-session';
import type { AppDatabase } from '../database/client';
import { resolveAutocodeSessionsRoot } from '../database/paths';
import { createWorkspaceRuntime } from './workspace-runtime';
import { createAgentSessionRepository } from './agent-session-repository';
import {
  buildInitialInputForProvider,
  getAgentProviderCommand,
  getAgentProviderDisplayName,
  mergeCustomEnvVars,
  resolveAgentProviderRuntime
} from './agent-session-provider';
import { createAgentSessionRuntimeManager } from './agent-session-runtime-manager';
import { createChatSessionRuntimeManager } from './chat-session-runtime-manager';
import { createBedrockChatSessionRuntimeManager } from './bedrock-chat-session-runtime-manager';
import { createPermissionService } from './permission-service';
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
  const permissionService = createPermissionService();
  const runtimeManager = createAgentSessionRuntimeManager({
    agentSessionRepository,
    publishEvent,
    publishWorkspaceInspectionChange
  });
  const chatRuntimeManager = createChatSessionRuntimeManager({
    agentSessionRepository,
    publishEvent,
    publishWorkspaceInspectionChange
  });
  const bedrockChatRuntimeManager = createBedrockChatSessionRuntimeManager({
    agentSessionRepository,
    permissionService,
    publishEvent,
    publishWorkspaceInspectionChange
  });

  function isChatSession(session: AgentSession | null): boolean {
    return session?.surface === 'chat';
  }

  function isBedrockChatSession(session: AgentSession | null): boolean {
    return session?.surface === 'chat' && session?.provider === 'claude-bedrock';
  }

  function getChatRuntimeForSession(session: AgentSession | null) {
    return isBedrockChatSession(session) ? bedrockChatRuntimeManager : chatRuntimeManager;
  }

  return {
    respondToPermission(response: PermissionResponse): void {
      permissionService.handlePermissionResponse(response);
    },

    async delete(input: DeleteAgentSessionInput): Promise<void> {
      const session = agentSessionRepository.findById(input.sessionId);

      if (isChatSession(session)) {
        await getChatRuntimeForSession(session).deleteSession(input.sessionId);
        return;
      }

      await runtimeManager.deleteSession(input.sessionId);
    },

    async deleteByTask(taskId: number): Promise<void> {
      const sessions = agentSessionRepository.listByTask(taskId);
      const deletions = new Array<Promise<void>>(sessions.length);

      for (let index = 0; index < sessions.length; index += 1) {
        const session = sessions[index]!;
        deletions[index] = isChatSession(session)
          ? getChatRuntimeForSession(session).deleteSession(session.id)
          : runtimeManager.deleteSession(session.id);
      }

      await Promise.all(deletions);
    },

    listByTask(input: ListAgentSessionsByTaskInput): AgentSession[] {
      return agentSessionRepository.listByTask(input.taskId);
    },

    rename(input: RenameAgentSessionInput): AgentSession {
      const session = agentSessionRepository.rename(
        input.sessionId,
        input.title,
        new Date().toISOString()
      );
      publishEvent({ type: 'snapshot', session });
      return session;
    },

    setSystemPrompt(input: SetSystemPromptInput): AgentSession {
      const session = agentSessionRepository.setSystemPrompt(
        input.sessionId,
        input.systemPrompt,
        new Date().toISOString()
      );

      bedrockChatRuntimeManager.updateSystemPrompt(
        input.sessionId,
        input.systemPrompt || undefined
      );

      publishEvent({ type: 'snapshot', session });
      return session;
    },

    async readTranscriptTail(
      input: ReadAgentSessionTranscriptTailInput
    ): Promise<ReadAgentSessionTranscriptTailResult> {
      const session = agentSessionRepository.findInternalById(input.sessionId);

      if (!session) {
        return { entries: [], lastEventSeq: 0 };
      }

      return readAgentSessionTranscriptTail(session.transcriptPath, input.maxEntries);
    },

    async reconcileInterruptedSessions(): Promise<void> {
      await mkdir(sessionsRoot, { recursive: true });
      repairInterruptedSessionTranscriptPaths(new Date().toISOString());
      await chatRuntimeManager.reconcileInterruptedChatSessions();
      await bedrockChatRuntimeManager.reconcileInterruptedChatSessions();
      await runtimeManager.reconcileInterruptedSessions();
    },

    async resize(input: ResizeAgentSessionInput): Promise<void> {
      const session = agentSessionRepository.findById(input.sessionId);

      if (isChatSession(session)) {
        return;
      }

      await runtimeManager.resizeRuntime(input.sessionId, input.cols, input.rows);
    },

    async sendInput(input: SendAgentSessionInput): Promise<void> {
      const session = agentSessionRepository.findById(input.sessionId);

      if (isChatSession(session)) {
        await getChatRuntimeForSession(session).sendChatMessage(input.sessionId, input.text);
        return;
      }

      await runtimeManager.writeToRuntime(input.sessionId, input.text);
    },

    async stop(input: StopAgentSessionInput): Promise<void> {
      const session = agentSessionRepository.findById(input.sessionId);

      if (!session) {
        return;
      }

      if (isChatSession(session)) {
        await getChatRuntimeForSession(session).stopChatSession(input.sessionId);
        return;
      }

      await runtimeManager.writeToRuntime(input.sessionId, '\x03');
    },

    async start(input: StartAgentSessionInput): Promise<AgentSession> {
      const context = await workspaceRuntime.observeWorkspaceContext(input.taskId);
      const timestamp = new Date().toISOString();
      const surface: AgentSessionSurface = input.surface ?? 'terminal';
      const command =
        surface === 'chat'
          ? (input.provider === 'claude-bedrock' ? 'chat:claude-bedrock' : 'chat:codex-sdk')
          : getAgentProviderCommand(input.provider);
      const transcriptPath = resolveAgentSessionTranscriptPath(sessionsRoot, randomUUID());
      let placeholderSession: AgentSession;

      try {
        placeholderSession = createPendingSession(
          timestamp,
          input.provider,
          surface,
          input.taskId,
          context.worktree.id,
          command,
          transcriptPath,
          input.systemPrompt
        );
      } catch (error) {
        throw error instanceof Error
          ? error
          : new Error('Autocode could not create the requested session.');
      }

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

      if (surface === 'chat') {
        const targetChatRuntime =
          input.provider === 'claude-bedrock' ? bedrockChatRuntimeManager : chatRuntimeManager;

        try {
          const runningSession = await targetChatRuntime.startChatSession({
            awsCredentials: input.awsCredentials,
            customEnvVars: input.customEnvVars,
            cwd: context.worktreePath,
            disablePromptCaching: input.disablePromptCaching,
            model: input.model,
            reasoningEffort: input.reasoningEffort,
            sessionId: placeholderSession.id,
            systemPrompt: input.systemPrompt,
            timestamp: new Date().toISOString(),
            transcriptPath
          });

          runtimeManager.publishSnapshot(runningSession);
          return runningSession;
        } catch (error) {
          throw error instanceof Error
            ? error
            : new Error('Autocode could not start the chat session.');
        }
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

      if (input.customEnvVars) {
        providerRuntime.env = mergeCustomEnvVars(providerRuntime.env, input.customEnvVars);
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
          await runtimeManager.writeToRuntime(runningSession.id, initialInput, 'system');
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
    }
  };

  function createPendingSession(
    createdAt: string,
    provider: AgentProvider,
    surface: AgentSessionSurface,
    taskId: number,
    worktreeId: number,
    command: string,
    transcriptPath: string,
    systemPrompt?: string
  ): AgentSession {
    return agentSessionRepository.create({
      command,
      createdAt,
      provider,
      surface,
      systemPrompt,
      taskId,
      transcriptPath,
      worktreeId
    });
  }

  function repairInterruptedSessionTranscriptPaths(timestamp: string): void {
    for (const session of agentSessionRepository.listActiveSessionRecords()) {
      if (session.transcriptPath.trim()) {
        continue;
      }

      agentSessionRepository.setTranscriptPath(
        session.id,
        resolveAgentSessionTranscriptPath(sessionsRoot, session.id),
        timestamp
      );
    }
  }

  function requireSession(sessionId: number): AgentSession {
    const session = agentSessionRepository.findById(sessionId);

    if (!session) {
      throw new Error('Agent session could not be found.');
    }

    return session;
  }
}
