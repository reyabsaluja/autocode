import { rm } from 'node:fs/promises';

import { spawn, type IPty } from 'node-pty';

import type {
  AgentProvider,
  AgentSession,
  AgentSessionEvent,
  AgentSessionTranscriptEntry,
  AgentSessionTranscriptStream
} from '../../shared/domain/agent-session';
import { agentSessionEventSchema } from '../../shared/domain/agent-session';
import { parseIpcPayload } from '../../shared/ipc/validation';
import { getAgentProviderDisplayName, normalizeAgentSpawnError } from './agent-session-provider';
import { createAgentSessionRepository } from './agent-session-repository';
import {
  appendAgentSessionTranscriptEntry,
  ensureAgentSessionTranscriptFile,
  formatAgentSessionTranscriptEntry
} from './agent-session-transcript';

interface AgentSessionRuntime {
  finalized: boolean;
  pty: IPty;
  sessionId: number;
}

interface FinalizeAgentSessionOptions {
  exitCode: number | null;
  killRuntime: boolean;
  lastError: string | null;
  status: 'completed' | 'failed' | 'terminated';
  systemMessage?: string;
}

interface StartAgentSessionRuntimeInput {
  cols: number;
  cwd: string;
  env: Record<string, string>;
  executablePath: string;
  provider: AgentProvider;
  rows: number;
  sessionId: number;
  transcriptPath: string;
}

type AgentSessionEventPublisher = (event: AgentSessionEvent) => void;

const ACTIVE_AGENT_SESSION_STATUSES = new Set(['starting', 'running']);

export function createAgentSessionRuntimeManager({
  agentSessionRepository,
  publishEvent
}: {
  agentSessionRepository: ReturnType<typeof createAgentSessionRepository>;
  publishEvent: AgentSessionEventPublisher;
}) {
  const runtimes = new Map<number, AgentSessionRuntime>();
  const sessionQueues = new Map<number, Promise<unknown>>();

  return {
    deleteSession,
    failPendingSession,
    failRuntimeSession,
    prepareTranscript,
    publishSnapshot,
    reconcileInterruptedSessions,
    resizeRuntime,
    startRuntime,
    terminateSession,
    writeToRuntime
  };

  async function prepareTranscript(transcriptPath: string): Promise<void> {
    await ensureAgentSessionTranscriptFile(transcriptPath);
  }

  function publishSnapshot(session: AgentSession): void {
    emitEvent({
      session,
      type: 'snapshot'
    });
  }

  async function failPendingSession(input: {
    message: string;
    sessionId: number;
    timestamp: string;
    transcriptPath: string;
  }): Promise<AgentSession> {
    const failureEntry = await appendSystemEntryIfPossible(
      input.sessionId,
      input.transcriptPath,
      input.message,
      input.timestamp
    );
    const failedSession = agentSessionRepository.finalize({
      endedAt: input.timestamp,
      exitCode: null,
      lastError: input.message,
      sessionId: input.sessionId,
      status: 'failed'
    });

    if (failureEntry) {
      emitEvent({
        entries: [failureEntry],
        sessionId: input.sessionId,
        type: 'entries'
      });
    }

    emitEvent({
      session: failedSession,
      type: 'snapshot'
    });

    return failedSession;
  }

  async function reconcileInterruptedSessions(): Promise<void> {
    const timestamp = new Date().toISOString();

    for (const session of agentSessionRepository.listActiveSessions()) {
      const internalSession = agentSessionRepository.findInternalById(session.id);

      if (!internalSession) {
        continue;
      }

      const interruptionMessage =
        `Autocode interrupted this ${getAgentProviderDisplayName(session.provider)} session because the app restarted before it finished.`;

      await ensureAgentSessionTranscriptFile(internalSession.transcriptPath);
      const interruptionEntry = await appendSystemEntryIfPossible(
        session.id,
        internalSession.transcriptPath,
        interruptionMessage,
        timestamp
      );
      const nextSession = agentSessionRepository.finalize({
        endedAt: timestamp,
        exitCode: null,
        lastError: interruptionMessage,
        sessionId: session.id,
        status: 'terminated'
      });

      if (interruptionEntry) {
        emitEvent({
          entries: [interruptionEntry],
          sessionId: session.id,
          type: 'entries'
        });
      }

      emitEvent({
        session: nextSession,
        type: 'snapshot'
      });
    }
  }

  async function startRuntime(input: StartAgentSessionRuntimeInput): Promise<{ pid: number }> {
    let pty: IPty;

    try {
      pty = spawn(input.executablePath, [], {
        cols: input.cols,
        cwd: input.cwd,
        env: input.env,
        name: 'xterm-color',
        rows: input.rows
      });
    } catch (error) {
      const message = normalizeAgentSpawnError(error, input.provider);

      await failPendingSession({
        message,
        sessionId: input.sessionId,
        timestamp: new Date().toISOString(),
        transcriptPath: input.transcriptPath
      });
      throw new Error(message);
    }

    const runtime: AgentSessionRuntime = {
      finalized: false,
      pty,
      sessionId: input.sessionId
    };

    runtimes.set(input.sessionId, runtime);

    pty.onData((data) => {
      void handleRuntimeOutput(runtime.sessionId, input.transcriptPath, data);
    });
    pty.onExit((event) => {
      void handleRuntimeExit(runtime.sessionId, event.exitCode, input.provider);
    });

    return { pid: pty.pid };
  }

  async function resizeRuntime(sessionId: number, cols: number, rows: number): Promise<void> {
    const runtime = requireRuntime(sessionId);
    runtime.pty.resize(cols, rows);
  }

  async function writeToRuntime(sessionId: number, text: string): Promise<void> {
    const runtime = requireRuntime(sessionId);

    await enqueueSessionWork(sessionId, async () => {
      const internalSession = agentSessionRepository.findInternalById(sessionId);

      if (!internalSession) {
        throw new Error('Agent session could not be found.');
      }

      const entry = await appendTranscriptEntry(
        sessionId,
        internalSession.transcriptPath,
        'stdin',
        text,
        new Date().toISOString()
      );

      runtime.pty.write(text);
      emitEvent({
        entries: [entry],
        sessionId,
        type: 'entries'
      });
    });
  }

  async function failRuntimeSession(sessionId: number, error: unknown): Promise<void> {
    const message =
      error instanceof Error ? error.message : 'Autocode could not persist the active session.';

    await finalizeSession(sessionId, {
      exitCode: null,
      killRuntime: true,
      lastError: message,
      status: 'failed',
      systemMessage: message
    });
  }

  async function terminateSession(
    sessionId: number,
    systemMessage = 'Session terminated by user.'
  ): Promise<AgentSession> {
    return finalizeSession(sessionId, {
      exitCode: null,
      killRuntime: true,
      lastError: null,
      status: 'terminated',
      systemMessage
    });
  }

  async function deleteSession(sessionId: number): Promise<void> {
    const session = agentSessionRepository.findInternalById(sessionId);

    if (!session) {
      throw new Error('Agent session could not be found.');
    }

    if (ACTIVE_AGENT_SESSION_STATUSES.has(session.status)) {
      await finalizeSession(sessionId, {
        exitCode: null,
        killRuntime: true,
        lastError: null,
        status: 'terminated',
        systemMessage: 'Session deleted by user.'
      });
    }

    runtimes.delete(sessionId);
    sessionQueues.delete(sessionId);
    await rm(session.transcriptPath, { force: true });
    agentSessionRepository.delete(sessionId);
  }

  async function appendTranscriptEntry(
    sessionId: number,
    transcriptPath: string,
    stream: AgentSessionTranscriptStream,
    text: string,
    timestamp: string
  ): Promise<AgentSessionTranscriptEntry> {
    const session = requireSession(sessionId);
    const nextSeq = session.lastEventSeq + 1;
    const entry = formatAgentSessionTranscriptEntry(nextSeq, stream, text, timestamp);

    await appendAgentSessionTranscriptEntry(transcriptPath, entry);
    agentSessionRepository.updateLastEventSeq(sessionId, nextSeq, timestamp);

    return entry;
  }

  function emitEvent(event: AgentSessionEvent): void {
    const payload = parseIpcPayload(agentSessionEventSchema, event, 'agentSessions:event', 'response');
    publishEvent(payload);
  }

  async function finalizeSession(
    sessionId: number,
    options: FinalizeAgentSessionOptions
  ): Promise<AgentSession> {
    const runtime = runtimes.get(sessionId);
    const currentSession = agentSessionRepository.findInternalById(sessionId);

    if (!currentSession) {
      throw new Error('Agent session could not be found.');
    }

    if (!ACTIVE_AGENT_SESSION_STATUSES.has(currentSession.status) && currentSession.endedAt) {
      runtimes.delete(sessionId);
      return requireSession(sessionId);
    }

    if (runtime) {
      runtime.finalized = true;

      if (options.killRuntime) {
        runtime.pty.kill();
      }
    }

    const session = await enqueueSessionWork(sessionId, async () => {
      const internalSession = agentSessionRepository.findInternalById(sessionId);

      if (!internalSession) {
        throw new Error('Agent session could not be found.');
      }

      if (!ACTIVE_AGENT_SESSION_STATUSES.has(internalSession.status) && internalSession.endedAt) {
        return requireSession(sessionId);
      }

      const systemEntry = options.systemMessage
        ? await appendSystemEntryIfPossible(
            sessionId,
            internalSession.transcriptPath,
            options.systemMessage,
            new Date().toISOString()
          )
        : null;

      const nextSession = agentSessionRepository.finalize({
        endedAt: new Date().toISOString(),
        exitCode: options.exitCode,
        lastError: options.lastError,
        sessionId,
        status: options.status
      });

      if (systemEntry) {
        emitEvent({
          entries: [systemEntry],
          sessionId,
          type: 'entries'
        });
      }

      emitEvent({
        session: nextSession,
        type: 'snapshot'
      });

      return nextSession;
    });

    runtimes.delete(sessionId);
    return session;
  }

  async function handleRuntimeExit(sessionId: number, exitCode: number, provider: AgentProvider): Promise<void> {
    if (!runtimes.has(sessionId)) {
      return;
    }

    const displayName = getAgentProviderDisplayName(provider);

    await finalizeSession(sessionId, {
      exitCode,
      killRuntime: false,
      lastError: exitCode === 0 ? null : `${displayName} exited with code ${exitCode}.`,
      status: exitCode === 0 ? 'completed' : 'failed'
    });
  }

  async function handleRuntimeOutput(
    sessionId: number,
    transcriptPath: string,
    text: string
  ): Promise<void> {
    const runtime = runtimes.get(sessionId);

    if (!runtime || runtime.finalized || !text) {
      return;
    }

    try {
      const entry = await enqueueSessionWork(sessionId, async () =>
        appendTranscriptEntry(sessionId, transcriptPath, 'stdout', text, new Date().toISOString())
      );

      emitEvent({
        entries: [entry],
        sessionId,
        type: 'entries'
      });
    } catch (error) {
      await failRuntimeSession(sessionId, error);
    }
  }

  async function appendSystemEntryIfPossible(
    sessionId: number,
    transcriptPath: string,
    message: string,
    timestamp: string
  ): Promise<AgentSessionTranscriptEntry | null> {
    try {
      return await appendTranscriptEntry(sessionId, transcriptPath, 'system', message, timestamp);
    } catch {
      return null;
    }
  }

  function requireRuntime(sessionId: number): AgentSessionRuntime {
    const runtime = runtimes.get(sessionId);

    if (!runtime || runtime.finalized) {
      throw new Error('This session is no longer active.');
    }

    return runtime;
  }

  function requireSession(sessionId: number): AgentSession {
    const session = agentSessionRepository.findById(sessionId);

    if (!session) {
      throw new Error('Agent session could not be found.');
    }

    return session;
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
