import { rm } from 'node:fs/promises';

import { Codex, type Thread, type ThreadEvent, type ThreadItem } from '@openai/codex-sdk';

import type {
  AgentSession,
  AgentSessionEvent,
  AgentSessionTranscriptEntry,
  AgentSessionTranscriptStream
} from '../../shared/domain/agent-session';
import { agentSessionEventSchema } from '../../shared/domain/agent-session';
import { parseIpcPayload } from '../../shared/ipc/validation';
import { createAgentSessionRepository } from './agent-session-repository';
import {
  appendAgentSessionTranscriptEntry,
  ensureAgentSessionTranscriptFile,
  formatAgentSessionTranscriptEntry
} from './agent-session-transcript';

type AgentSessionEventPublisher = (event: AgentSessionEvent) => void;

interface ChatSessionRuntime {
  codex: Codex;
  cwd: string;
  thread: Thread;
  turnAbort: AbortController | null;
}

export function createChatSessionRuntimeManager({
  agentSessionRepository,
  publishEvent,
  publishWorkspaceInspectionChange
}: {
  agentSessionRepository: ReturnType<typeof createAgentSessionRepository>;
  publishEvent: AgentSessionEventPublisher;
  publishWorkspaceInspectionChange?: (taskId: number) => void;
}) {
  const runtimes = new Map<number, ChatSessionRuntime>();
  const sessionQueues = new Map<number, Promise<unknown>>();

  return {
    deleteSession,
    reconcileInterruptedChatSessions,
    sendChatMessage,
    startChatSession
  };

  async function startChatSession(input: {
    cwd: string;
    sessionId: number;
    timestamp: string;
    transcriptPath: string;
  }): Promise<AgentSession> {
    await ensureAgentSessionTranscriptFile(input.transcriptPath);

    const codex = new Codex();
    const thread = codex.startThread({
      skipGitRepoCheck: true,
      workingDirectory: input.cwd
    });

    runtimes.set(input.sessionId, {
      codex,
      cwd: input.cwd,
      thread,
      turnAbort: null
    });

    const runningSession = agentSessionRepository.markRunning(
      input.sessionId,
      process.pid,
      input.timestamp
    );

    await appendSystemEntryIfPossible(
      input.sessionId,
      input.transcriptPath,
      'Chat session ready. Send a message to run Codex against this worktree.',
      input.timestamp
    );

    return runningSession;
  }

  async function sendChatMessage(sessionId: number, text: string): Promise<void> {
    const runtime = runtimes.get(sessionId);

    if (!runtime) {
      throw new Error('This chat session is no longer active.');
    }

    if (runtime.turnAbort) {
      throw new Error('Codex is still responding to the previous message.');
    }

    const trimmed = text.replace(/\s+$/, '');

    if (!trimmed) {
      return;
    }

    const internalSession = agentSessionRepository.findInternalById(sessionId);

    if (!internalSession) {
      throw new Error('Chat session could not be found.');
    }

    const transcriptPath = internalSession.transcriptPath;

    await enqueueSessionWork(sessionId, async () => {
      const entry = await appendTranscriptEntry(
        sessionId,
        transcriptPath,
        'stdin',
        `${trimmed}\n`,
        new Date().toISOString()
      );

      emitEntries(sessionId, [entry]);
    });

    const abort = new AbortController();
    runtime.turnAbort = abort;

    try {
      const streamed = await runtime.thread.runStreamed(trimmed, { signal: abort.signal });

      for await (const event of streamed.events) {
        await handleThreadEvent(sessionId, transcriptPath, event);
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Codex failed to respond to this chat turn.';
      await writeSystemMessage(sessionId, transcriptPath, message);
    } finally {
      runtime.turnAbort = null;
      publishWorkspaceInspectionChange?.(internalSession.taskId);
    }
  }

  async function handleThreadEvent(
    sessionId: number,
    transcriptPath: string,
    event: ThreadEvent
  ): Promise<void> {
    const translated = translateThreadEvent(event);

    if (!translated) {
      return;
    }

    if (Array.isArray(translated)) {
      for (const entry of translated) {
        await writeTranscriptEntry(
          sessionId,
          transcriptPath,
          entry.stream,
          entry.text,
          entry.itemId
        );
      }
      return;
    }

    await writeTranscriptEntry(
      sessionId,
      transcriptPath,
      translated.stream,
      translated.text,
      translated.itemId
    );
  }

  type TranslatedEntry = {
    stream: AgentSessionTranscriptStream;
    text: string;
    itemId?: string;
  };

  function translateThreadEvent(
    event: ThreadEvent
  ): TranslatedEntry | TranslatedEntry[] | null {
    switch (event.type) {
      case 'turn.started':
        return { stream: 'turn-start', text: '' };

      case 'turn.completed':
        return {
          stream: 'turn-done',
          text: JSON.stringify({
            inputTokens: event.usage.input_tokens,
            cachedInputTokens: event.usage.cached_input_tokens,
            outputTokens: event.usage.output_tokens,
            reasoningOutputTokens: event.usage.reasoning_output_tokens
          })
        };

      case 'turn.failed':
        return {
          stream: 'system',
          text: `Codex turn failed: ${event.error.message}`
        };

      case 'error':
        return { stream: 'system', text: `Codex error: ${event.message}` };

      case 'item.started':
        return translateItemStarted(event.item);

      case 'item.updated':
        return translateItemUpdated(event.item);

      case 'item.completed':
        return translateItemCompleted(event.item);

      default:
        return null;
    }
  }

  function translateItemStarted(
    item: ThreadItem
  ): TranslatedEntry | TranslatedEntry[] | null {
    switch (item.type) {
      case 'agent_message':
        return {
          stream: 'assistant-delta',
          text: item.text,
          itemId: item.id
        };

      case 'reasoning':
        return {
          stream: 'thinking',
          text: item.text,
          itemId: item.id
        };

      case 'command_execution':
        return {
          stream: 'tool-start',
          text: JSON.stringify({
            type: 'command',
            command: item.command,
            status: item.status
          }),
          itemId: item.id
        };

      case 'file_change':
        return {
          stream: 'tool-start',
          text: JSON.stringify({
            type: 'file_change',
            changes: item.changes,
            status: item.status
          }),
          itemId: item.id
        };

      case 'mcp_tool_call':
        return {
          stream: 'tool-start',
          text: JSON.stringify({
            type: 'mcp',
            server: item.server,
            tool: item.tool,
            status: item.status
          }),
          itemId: item.id
        };

      case 'web_search':
        return {
          stream: 'tool-start',
          text: JSON.stringify({
            type: 'web_search',
            query: item.query
          }),
          itemId: item.id
        };

      case 'todo_list':
        return {
          stream: 'todo-list',
          text: JSON.stringify({ items: item.items }),
          itemId: item.id
        };

      default:
        return null;
    }
  }

  function translateItemUpdated(
    item: ThreadItem
  ): TranslatedEntry | TranslatedEntry[] | null {
    switch (item.type) {
      case 'agent_message':
        return {
          stream: 'assistant-delta',
          text: item.text,
          itemId: item.id
        };

      case 'reasoning':
        return {
          stream: 'thinking',
          text: item.text,
          itemId: item.id
        };

      case 'command_execution':
        return {
          stream: 'tool-update',
          text: JSON.stringify({
            type: 'command',
            command: item.command,
            output: item.aggregated_output,
            status: item.status,
            exitCode: item.exit_code
          }),
          itemId: item.id
        };

      case 'todo_list':
        return {
          stream: 'todo-list',
          text: JSON.stringify({ items: item.items }),
          itemId: item.id
        };

      default:
        return null;
    }
  }

  function translateItemCompleted(
    item: ThreadItem
  ): TranslatedEntry | TranslatedEntry[] | null {
    switch (item.type) {
      case 'agent_message':
        return {
          stream: 'assistant-done',
          text: item.text,
          itemId: item.id
        };

      case 'reasoning':
        return {
          stream: 'thinking',
          text: item.text,
          itemId: item.id
        };

      case 'command_execution': {
        return {
          stream: 'tool-done',
          text: JSON.stringify({
            type: 'command',
            command: item.command,
            output: item.aggregated_output,
            exitCode: item.exit_code,
            status: item.status
          }),
          itemId: item.id
        };
      }

      case 'file_change':
        return {
          stream: 'tool-done',
          text: JSON.stringify({
            type: 'file_change',
            changes: item.changes,
            status: item.status
          }),
          itemId: item.id
        };

      case 'mcp_tool_call':
        return {
          stream: 'tool-done',
          text: JSON.stringify({
            type: 'mcp',
            server: item.server,
            tool: item.tool,
            status: item.status,
            error: item.error
          }),
          itemId: item.id
        };

      case 'web_search':
        return {
          stream: 'tool-done',
          text: JSON.stringify({
            type: 'web_search',
            query: item.query
          }),
          itemId: item.id
        };

      case 'todo_list':
        return {
          stream: 'todo-list',
          text: JSON.stringify({ items: item.items }),
          itemId: item.id
        };

      case 'error':
        return {
          stream: 'system',
          text: `Codex error: ${item.message}`,
          itemId: item.id
        };

      default:
        return null;
    }
  }

  async function deleteSession(sessionId: number): Promise<void> {
    const runtime = runtimes.get(sessionId);
    const session = agentSessionRepository.findInternalById(sessionId);

    if (!session) {
      return;
    }

    if (runtime?.turnAbort) {
      runtime.turnAbort.abort();
    }

    runtimes.delete(sessionId);
    sessionQueues.delete(sessionId);

    if (session.status === 'starting' || session.status === 'running') {
      const nextSession = agentSessionRepository.finalize({
        endedAt: new Date().toISOString(),
        exitCode: null,
        lastError: null,
        sessionId,
        status: 'terminated'
      });

      emitSnapshot(nextSession);
    }

    await rm(session.transcriptPath, { force: true });
    agentSessionRepository.delete(sessionId);
  }

  async function reconcileInterruptedChatSessions(): Promise<void> {
    const timestamp = new Date().toISOString();
    const activeSessions = agentSessionRepository.listActiveSessionRecords();

    for (const session of activeSessions) {
      if (session.surface !== 'chat') {
        continue;
      }

      const message =
        'Autocode interrupted this chat session because the app restarted before it finished.';

      await ensureAgentSessionTranscriptFile(session.transcriptPath);
      await appendSystemEntryIfPossible(session.id, session.transcriptPath, message, timestamp);

      const nextSession = agentSessionRepository.finalize({
        endedAt: timestamp,
        exitCode: null,
        lastError: message,
        sessionId: session.id,
        status: 'terminated'
      });

      emitSnapshot(nextSession);
    }
  }

  async function writeSystemMessage(
    sessionId: number,
    transcriptPath: string,
    text: string
  ): Promise<void> {
    await writeTranscriptEntry(sessionId, transcriptPath, 'system', text);
  }

  async function writeTranscriptEntry(
    sessionId: number,
    transcriptPath: string,
    stream: AgentSessionTranscriptStream,
    text: string,
    itemId?: string
  ): Promise<void> {
    await enqueueSessionWork(sessionId, async () => {
      const entry = await appendTranscriptEntry(
        sessionId,
        transcriptPath,
        stream,
        text,
        new Date().toISOString(),
        itemId
      );

      emitEntries(sessionId, [entry]);
    });
  }

  async function appendTranscriptEntry(
    sessionId: number,
    transcriptPath: string,
    stream: AgentSessionTranscriptStream,
    text: string,
    timestamp: string,
    itemId?: string
  ): Promise<AgentSessionTranscriptEntry> {
    const session = agentSessionRepository.findById(sessionId);

    if (!session) {
      throw new Error('Chat session could not be found.');
    }

    const nextSeq = session.lastEventSeq + 1;
    const entry = formatAgentSessionTranscriptEntry(nextSeq, stream, text, timestamp, itemId);

    await appendAgentSessionTranscriptEntry(transcriptPath, entry);
    agentSessionRepository.updateLastEventSeq(sessionId, nextSeq, timestamp);

    return entry;
  }

  async function appendSystemEntryIfPossible(
    sessionId: number,
    transcriptPath: string,
    message: string,
    timestamp: string
  ): Promise<AgentSessionTranscriptEntry | null> {
    try {
      const entry = await appendTranscriptEntry(
        sessionId,
        transcriptPath,
        'system',
        message,
        timestamp
      );
      emitEntries(sessionId, [entry]);
      return entry;
    } catch {
      return null;
    }
  }

  function emitEntries(sessionId: number, entries: AgentSessionTranscriptEntry[]): void {
    const session = agentSessionRepository.findById(sessionId);

    if (!session) {
      return;
    }

    emitEvent({
      entries,
      sessionId,
      taskId: session.taskId,
      type: 'entries'
    });
  }

  function emitSnapshot(session: AgentSession): void {
    emitEvent({
      session,
      type: 'snapshot'
    });
  }

  function emitEvent(event: AgentSessionEvent): void {
    const payload = parseIpcPayload(agentSessionEventSchema, event, 'agentSessions:event', 'response');
    publishEvent(payload);
  }

  async function enqueueSessionWork<T>(sessionId: number, work: () => Promise<T>): Promise<T> {
    const previous = sessionQueues.get(sessionId) ?? Promise.resolve();
    const result = previous.catch(() => undefined).then(work);
    const tracked = result.then(
      () => undefined,
      () => undefined
    );

    sessionQueues.set(sessionId, tracked);

    try {
      return await result;
    } finally {
      if (sessionQueues.get(sessionId) === tracked) {
        sessionQueues.delete(sessionId);
      }
    }
  }
}
