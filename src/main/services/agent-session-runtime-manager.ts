import { rm } from 'node:fs/promises';
import os from 'node:os';

import { spawn as spawnPtyProcess, type IPty } from 'node-pty';

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
import {
  checkTmuxAvailability,
  createTmuxSession,
  getTmuxAttachSpawnArgs,
  getTmuxSessionName,
  isTmuxSessionAlive,
  killTmuxSession,
  resizeTmuxSession
} from './tmux-client';

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
const WORKSPACE_INSPECTION_REFRESH_THROTTLE_MS = 1_000;

interface AgentSessionRuntimeManagerDependencies {
  checkTmuxAvailability: typeof checkTmuxAvailability;
  createTmuxSession: typeof createTmuxSession;
  getTmuxAttachSpawnArgs: typeof getTmuxAttachSpawnArgs;
  getTmuxSessionName: typeof getTmuxSessionName;
  isTmuxSessionAlive: typeof isTmuxSessionAlive;
  killTmuxSession: typeof killTmuxSession;
  resizeTmuxSession: typeof resizeTmuxSession;
  spawnPty: typeof spawnPtyProcess;
}

const defaultRuntimeManagerDependencies: AgentSessionRuntimeManagerDependencies = {
  checkTmuxAvailability,
  createTmuxSession,
  getTmuxAttachSpawnArgs,
  getTmuxSessionName,
  isTmuxSessionAlive,
  killTmuxSession,
  resizeTmuxSession,
  spawnPty: spawnPtyProcess
};

export function createAgentSessionRuntimeManager({
  agentSessionRepository,
  dependencies,
  publishEvent,
  publishWorkspaceInspectionChange
}: {
  agentSessionRepository: ReturnType<typeof createAgentSessionRepository>;
  dependencies?: Partial<AgentSessionRuntimeManagerDependencies>;
  publishEvent: AgentSessionEventPublisher;
  publishWorkspaceInspectionChange?: (taskId: number) => void;
}) {
  const runtimes = new Map<number, AgentSessionRuntime>();
  const sessionQueues = new Map<number, Promise<unknown>>();
  const workspaceInspectionRefreshTimers = new Map<number, ReturnType<typeof setTimeout>>();
  const tmuxSessionNames = new Map<number, string>();
  const runtimeDependencies: AgentSessionRuntimeManagerDependencies = {
    ...defaultRuntimeManagerDependencies,
    ...dependencies
  };
  let tmuxAvailable = false;

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
        taskId: failedSession.taskId,
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
    tmuxAvailable = await runtimeDependencies.checkTmuxAvailability();
    const timestamp = new Date().toISOString();

    for (const session of agentSessionRepository.listActiveSessions()) {
      const internalSession = agentSessionRepository.findInternalById(session.id);

      if (!internalSession) {
        continue;
      }

      if (tmuxAvailable) {
        const sessionName = runtimeDependencies.getTmuxSessionName(session.id);
        const alive = await runtimeDependencies.isTmuxSessionAlive(sessionName);

        if (alive) {
          try {
            await ensureAgentSessionTranscriptFile(internalSession.transcriptPath);
            await appendSystemEntryIfPossible(
              session.id,
              internalSession.transcriptPath,
              `Reconnected to this ${getAgentProviderDisplayName(session.provider)} session after Autocode restarted.`,
              timestamp
            );
            await reconnectRuntime({
              provider: session.provider,
              sessionId: session.id,
              transcriptPath: internalSession.transcriptPath
            });
            continue;
          } catch {
            // Reconnection failed — fall through to terminate
          }
        }
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
          taskId: nextSession.taskId,
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
    let usedTmux = false;
    let createdTmuxSessionName: string | null = null;

    if (tmuxAvailable) {
      try {
        const sessionName = runtimeDependencies.getTmuxSessionName(input.sessionId);

        await runtimeDependencies.createTmuxSession({
          cols: input.cols,
          cwd: input.cwd,
          env: input.env,
          executablePath: input.executablePath,
          rows: input.rows,
          sessionName
        });
        createdTmuxSessionName = sessionName;
        tmuxSessionNames.set(input.sessionId, sessionName);

        const attach = runtimeDependencies.getTmuxAttachSpawnArgs(sessionName);
        pty = runtimeDependencies.spawnPty(attach.command, attach.args, {
          cols: input.cols,
          cwd: input.cwd,
          env: input.env,
          name: 'xterm-color',
          rows: input.rows
        });

        createdTmuxSessionName = null;
        usedTmux = true;
      } catch (error) {
        const cleanedUpTmuxSession = await cleanupFailedTmuxStart(createdTmuxSessionName);

        if (cleanedUpTmuxSession) {
          tmuxSessionNames.delete(input.sessionId);
        }

        if (!cleanedUpTmuxSession) {
          const message = buildTmuxFallbackCleanupErrorMessage(input.provider);

          await failPendingSession({
            message,
            sessionId: input.sessionId,
            timestamp: new Date().toISOString(),
            transcriptPath: input.transcriptPath
          });
          throw error instanceof Error ? new Error(message, { cause: error }) : new Error(message);
        }

        // tmux session creation failed — fall through to direct spawn
        usedTmux = false;
      }
    }

    if (!usedTmux) {
      try {
        pty = runtimeDependencies.spawnPty(input.executablePath, [], {
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
    }

    const runtime: AgentSessionRuntime = {
      finalized: false,
      pty: pty!,
      sessionId: input.sessionId
    };

    runtimes.set(input.sessionId, runtime);

    pty!.onData((data) => {
      void handleRuntimeOutput(runtime.sessionId, input.transcriptPath, data);
    });
    pty!.onExit((event) => {
      void handleRuntimeExit(runtime.sessionId, event.exitCode, input.provider);
    });

    return { pid: pty!.pid };
  }

  async function reconnectRuntime(input: {
    provider: AgentProvider;
    sessionId: number;
    transcriptPath: string;
  }): Promise<void> {
    const sessionName = runtimeDependencies.getTmuxSessionName(input.sessionId);
    const attach = runtimeDependencies.getTmuxAttachSpawnArgs(sessionName);
    const attachEnv = buildAttachProcessEnv();

    const pty = runtimeDependencies.spawnPty(attach.command, attach.args, {
      cols: 120,
      cwd: os.homedir(),
      env: attachEnv,
      name: 'xterm-color',
      rows: 30
    });

    const runtime: AgentSessionRuntime = {
      finalized: false,
      pty,
      sessionId: input.sessionId
    };

    runtimes.set(input.sessionId, runtime);
    tmuxSessionNames.set(input.sessionId, sessionName);

    pty.onData((data) => {
      void handleRuntimeOutput(runtime.sessionId, input.transcriptPath, data);
    });
    pty.onExit((event) => {
      void handleRuntimeExit(runtime.sessionId, event.exitCode, input.provider);
    });
  }

  async function resizeRuntime(sessionId: number, cols: number, rows: number): Promise<void> {
    const runtime = requireRuntime(sessionId);
    runtime.pty.resize(cols, rows);

    const sessionName = tmuxSessionNames.get(sessionId);
    if (sessionName) {
      await runtimeDependencies.resizeTmuxSession(sessionName, cols, rows);
    }
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
        taskId: requireSession(sessionId).taskId,
        sessionId,
        type: 'entries'
      });
      scheduleWorkspaceInspectionRefresh(sessionId);
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

    const sessionName = tmuxSessionNames.get(sessionId);
    if (sessionName) {
      await runtimeDependencies.killTmuxSession(sessionName);
      tmuxSessionNames.delete(sessionId);
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
        const sessionName = tmuxSessionNames.get(sessionId);
        if (sessionName) {
          await runtimeDependencies.killTmuxSession(sessionName);
          tmuxSessionNames.delete(sessionId);
        }
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
          taskId: nextSession.taskId,
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
    flushWorkspaceInspectionRefresh(currentSession.taskId);
    return session;
  }

  async function handleRuntimeExit(sessionId: number, exitCode: number, provider: AgentProvider): Promise<void> {
    if (!runtimes.has(sessionId)) {
      return;
    }

    const sessionName = tmuxSessionNames.get(sessionId);

    if (sessionName) {
      const alive = await runtimeDependencies.isTmuxSessionAlive(sessionName);

      if (alive) {
        // The tmux attach process disconnected (app closing or crash),
        // but the agent is still running inside tmux. Remove the dead
        // runtime without finalizing so reconcile can reconnect later.
        runtimes.delete(sessionId);

        const internalSession = agentSessionRepository.findInternalById(sessionId);

        if (internalSession) {
          try {
            await reconnectRuntime({
              provider,
              sessionId,
              transcriptPath: internalSession.transcriptPath
            });
          } catch {
            // Auto-reconnect failed; session stays running but non-interactive
            // until the app restarts and reconcile reconnects.
          }
        }

        return;
      }

      tmuxSessionNames.delete(sessionId);
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
        taskId: requireSession(sessionId).taskId,
        sessionId,
        type: 'entries'
      });
      scheduleWorkspaceInspectionRefresh(sessionId);
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

  async function cleanupFailedTmuxStart(sessionName: string | null): Promise<boolean> {
    if (!sessionName) {
      return true;
    }

    await runtimeDependencies.killTmuxSession(sessionName);

    const stillAlive = await runtimeDependencies.isTmuxSessionAlive(sessionName);

    if (!stillAlive) {
      return true;
    }

    return false;
  }

  function buildTmuxFallbackCleanupErrorMessage(provider: AgentProvider): string {
    return `Autocode could not clean up the tmux-backed ${getAgentProviderDisplayName(provider)} session after startup failed, so it did not fall back to a second process.`;
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

  function scheduleWorkspaceInspectionRefresh(sessionId: number): void {
    if (!publishWorkspaceInspectionChange) {
      return;
    }

    const session = agentSessionRepository.findById(sessionId);

    if (!session || workspaceInspectionRefreshTimers.has(session.taskId)) {
      return;
    }

    const timeout = setTimeout(() => {
      workspaceInspectionRefreshTimers.delete(session.taskId);
      publishWorkspaceInspectionChange(session.taskId);
    }, WORKSPACE_INSPECTION_REFRESH_THROTTLE_MS);

    workspaceInspectionRefreshTimers.set(session.taskId, timeout);
  }

  function flushWorkspaceInspectionRefresh(taskId: number): void {
    if (!publishWorkspaceInspectionChange) {
      return;
    }

    const timeout = workspaceInspectionRefreshTimers.get(taskId);

    if (timeout) {
      clearTimeout(timeout);
      workspaceInspectionRefreshTimers.delete(taskId);
    }

    publishWorkspaceInspectionChange(taskId);
  }

  function buildAttachProcessEnv(): Record<string, string> {
    return Object.fromEntries(
      Object.entries(process.env).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string'
      )
    );
  }
}
