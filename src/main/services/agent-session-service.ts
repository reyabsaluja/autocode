import { constants as fsConstants } from 'node:fs';
import { access, mkdir, realpath, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { spawn, type IPty } from 'node-pty';

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
import type {
  AgentProvider,
  AgentSession,
  AgentSessionEvent,
  AgentSessionTranscriptEntry,
  AgentSessionTranscriptStream
} from '../../shared/domain/agent-session';
import { agentSessionEventSchema } from '../../shared/domain/agent-session';
import { parseIpcPayload } from '../../shared/ipc/validation';
import type { AppDatabase } from '../database/client';
import { resolveAutocodeSessionsRoot } from '../database/paths';
import { createWorkspaceRuntime } from './workspace-runtime';
import { createAgentSessionRepository } from './agent-session-repository';
import {
  appendAgentSessionTranscriptEntry,
  ensureAgentSessionTranscriptFile,
  formatAgentSessionTranscriptEntry,
  readAgentSessionTranscriptTail,
  resolveAgentSessionTranscriptPath
} from './agent-session-transcript';

interface AgentSessionRuntime {
  finalized: boolean;
  pty: IPty;
  sessionId: number;
}

interface FinalizeSessionOptions {
  exitCode: number | null;
  killRuntime: boolean;
  lastError: string | null;
  status: 'completed' | 'failed' | 'terminated';
  systemMessage?: string;
}

type AgentSessionEventPublisher = (event: AgentSessionEvent) => void;

const ACTIVE_AGENT_SESSION_STATUSES = new Set(['starting', 'running']);
const CODEX_COMMAND = 'codex';
const CLAUDE_CODE_COMMAND = 'claude';

const PROVIDER_DISPLAY_NAMES: Record<AgentProvider, string> = {
  'claude-code': 'Claude Code',
  'codex': 'Codex',
  'terminal': 'Terminal'
};

export function createAgentSessionService(
  db: AppDatabase,
  publishEvent: AgentSessionEventPublisher
) {
  const agentSessionRepository = createAgentSessionRepository(db);
  const workspaceRuntime = createWorkspaceRuntime(db);
  const sessionsRoot = resolveAutocodeSessionsRoot();
  const runtimes = new Map<number, AgentSessionRuntime>();
  const sessionQueues = new Map<number, Promise<unknown>>();

  return {
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

    async delete(input: DeleteAgentSessionInput): Promise<void> {
      await deleteSession(input.sessionId);
    },

    async reconcileInterruptedSessions(): Promise<void> {
      await mkdir(sessionsRoot, { recursive: true });
      const timestamp = new Date().toISOString();

      for (const session of agentSessionRepository.listActiveSessions()) {
        const internalSession = agentSessionRepository.findInternalById(session.id);

        if (!internalSession) {
          continue;
        }

        const displayName = PROVIDER_DISPLAY_NAMES[session.provider] ?? session.provider;
        const interruptionMessage =
          `Autocode interrupted this ${displayName} session because the app restarted before it finished.`;

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
    },

    async resize(input: ResizeAgentSessionInput): Promise<void> {
      const runtime = requireRuntime(input.sessionId);
      runtime.pty.resize(input.cols, input.rows);
    },

    async sendInput(input: SendAgentSessionInput): Promise<void> {
      await writeToRuntime(input.sessionId, input.text);
    },

    async start(input: StartAgentSessionInput): Promise<AgentSession> {
      const provider = input.provider;
      const displayName = PROVIDER_DISPLAY_NAMES[provider];

      if (agentSessionRepository.findActiveByTaskIdAndProvider(input.taskId, provider)) {
        throw new Error(`This task already has an active ${displayName} session.`);
      }

      const context = await workspaceRuntime.observeWorkspaceContext(input.taskId);
      const timestamp = new Date().toISOString();
      const command = resolveCommandNameForProvider(provider);
      let placeholderSession: AgentSession;

      try {
        placeholderSession = agentSessionRepository.create({
          command,
          createdAt: timestamp,
          provider,
          taskId: input.taskId,
          transcriptPath: '',
          worktreeId: context.worktree.id
        });
      } catch (error) {
        throw new Error(normalizeActiveSessionConflict(error, displayName));
      }
      const transcriptPath = resolveAgentSessionTranscriptPath(sessionsRoot, placeholderSession.id);

      agentSessionRepository.setTranscriptPath(placeholderSession.id, transcriptPath, timestamp);
      try {
        await ensureAgentSessionTranscriptFile(transcriptPath);
      } catch (error) {
        const message = 'Autocode could not create the session transcript on disk.';
        const failedSession = agentSessionRepository.finalize({
          endedAt: timestamp,
          exitCode: null,
          lastError: message,
          sessionId: placeholderSession.id,
          status: 'failed'
        });
        emitEvent({
          session: failedSession,
          type: 'snapshot'
        });

        throw error instanceof Error ? new Error(message, { cause: error }) : new Error(message);
      }

      let pty: IPty;
      const executablePath = await resolveExecutableForProvider(provider);
      const sessionProcessEnv = buildAgentProcessEnv();

      try {
        pty = spawn(executablePath, [], {
          cols: input.cols,
          cwd: context.worktreePath,
          env: sessionProcessEnv,
          name: 'xterm-color',
          rows: input.rows
        });
      } catch (error) {
        const message = normalizeAgentSpawnError(error, displayName);

        const failureEntry = await appendSystemEntryIfPossible(
          placeholderSession.id,
          transcriptPath,
          message,
          timestamp
        );

        const failedSession = agentSessionRepository.finalize({
          endedAt: timestamp,
          exitCode: null,
          lastError: message,
          sessionId: placeholderSession.id,
          status: 'failed'
        });

        if (failureEntry) {
          emitEvent({
            entries: [failureEntry],
            sessionId: placeholderSession.id,
            type: 'entries'
          });
        }
        emitEvent({
          session: failedSession,
          type: 'snapshot'
        });

        throw new Error(message);
      }

      const runtime: AgentSessionRuntime = {
        finalized: false,
        pty,
        sessionId: placeholderSession.id
      };

      runtimes.set(placeholderSession.id, runtime);

      pty.onData((data) => {
        void handleRuntimeOutput(runtime.sessionId, transcriptPath, data);
      });
      pty.onExit((event) => {
        void handleRuntimeExit(runtime.sessionId, event.exitCode, provider);
      });

      const runningSession = agentSessionRepository.markRunning(
        placeholderSession.id,
        pty.pid,
        new Date().toISOString()
      );

      if (provider !== 'terminal') {
        const initialPrompt = buildInitialPrompt(context.task.title, context.task.description);

        try {
          if (initialPrompt) {
            await writeToRuntime(runningSession.id, initialPrompt);
          }
        } catch (error) {
          await failRuntimeSession(runningSession.id, error);
          throw error instanceof Error
            ? error
            : new Error(`Autocode could not send the initial prompt to ${displayName}.`);
        }
      }

      const session = requireSession(runningSession.id);
      emitEvent({
        session,
        type: 'snapshot'
      });

      return session;
    },

    async terminate(input: TerminateAgentSessionInput): Promise<AgentSession> {
      return finalizeSession(input.sessionId, {
        exitCode: null,
        killRuntime: true,
        lastError: null,
        status: 'terminated',
        systemMessage: 'Session terminated by user.'
      });
    },

    async deleteByTask(taskId: number): Promise<void> {
      const sessions = agentSessionRepository.listByTask(taskId);

      for (const session of sessions) {
        await deleteSession(session.id);
      }
    }
  };

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
    options: FinalizeSessionOptions
  ): Promise<AgentSession> {
    const runtime = runtimes.get(sessionId);
    const currentSession = agentSessionRepository.findInternalById(sessionId);

    if (!currentSession) {
      throw new Error('Agent session could not be found.');
    }

    if (
      !ACTIVE_AGENT_SESSION_STATUSES.has(currentSession.status) &&
      currentSession.endedAt
    ) {
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

      if (
        !ACTIVE_AGENT_SESSION_STATUSES.has(internalSession.status) &&
        internalSession.endedAt
      ) {
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

    const displayName = PROVIDER_DISPLAY_NAMES[provider] ?? provider;

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

function buildInitialPrompt(title: string, description: string | null): string {
  const normalizedTitle = title.trim();
  const normalizedDescription = description?.trim() ?? '';

  if (!normalizedTitle) {
    return '';
  }

  if (!normalizedDescription) {
    return `${normalizedTitle}\n`;
  }

  return `${normalizedTitle}\n\n${normalizedDescription}\n`;
}

function resolveCommandNameForProvider(provider: AgentProvider): string {
  switch (provider) {
    case 'codex':
      return CODEX_COMMAND;
    case 'claude-code':
      return CLAUDE_CODE_COMMAND;
    case 'terminal':
      return process.env.SHELL ?? '/bin/zsh';
  }
}

async function resolveExecutableForProvider(provider: AgentProvider): Promise<string> {
  switch (provider) {
    case 'codex':
      return resolveCodexExecutablePath();
    case 'claude-code':
      return resolveClaudeCodeExecutablePath();
    case 'terminal':
      return resolveShellExecutablePath();
  }
}

function normalizeAgentSpawnError(error: unknown, displayName: string): string {
  const message = error instanceof Error ? error.message : String(error);

  if (
    message.includes('ENOENT') ||
    message.includes('not found') ||
    message.includes('posix_spawnp failed')
  ) {
    return `${displayName} is not installed or is not available on PATH.`;
  }

  if (!message) {
    return `Autocode could not start ${displayName}.`;
  }

  return message;
}

function normalizeActiveSessionConflict(error: unknown, displayName: string): string {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes('agent_sessions_task_provider_active_unique')) {
    return `This task already has an active ${displayName} session.`;
  }

  return message || `Autocode could not create a new ${displayName} session.`;
}

function buildAgentProcessEnv(): Record<string, string> {
  const env = Object.fromEntries(
    Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
  );
  const pathEntries = getCliSearchPaths(process.env.PATH);

  env.PATH = pathEntries.join(path.delimiter);
  return env;
}

async function resolveCodexExecutablePath(): Promise<string> {
  return resolveCliExecutablePath(CODEX_COMMAND, 'Codex CLI');
}

async function resolveClaudeCodeExecutablePath(): Promise<string> {
  return resolveCliExecutablePath(CLAUDE_CODE_COMMAND, 'Claude Code CLI');
}

async function resolveShellExecutablePath(): Promise<string> {
  const shell = process.env.SHELL;

  if (shell && await isExecutableFile(shell)) {
    return shell;
  }

  for (const fallback of ['/bin/zsh', '/bin/bash', '/bin/sh']) {
    if (await isExecutableFile(fallback)) {
      return fallback;
    }
  }

  throw new Error('Could not find a shell executable on this system.');
}

async function resolveCliExecutablePath(command: string, displayName: string): Promise<string> {
  for (const candidate of getCliExecutableCandidates(command, process.env.PATH)) {
    if (await isExecutableFile(candidate)) {
      return realpath(candidate).catch(() => candidate);
    }
  }

  throw new Error(`${displayName} is not installed or is not available on PATH.`);
}

function getCliExecutableCandidates(command: string, currentPath: string | undefined): string[] {
  const fileNames = process.platform === 'win32'
    ? getWindowsExecutableNames(command)
    : [command];

  return getCliSearchPaths(currentPath).flatMap((directoryPath) =>
    fileNames.map((fileName) => path.join(directoryPath, fileName))
  );
}

function getCliSearchPaths(currentPath: string | undefined): string[] {
  const pathEntries = (currentPath ?? '')
    .split(path.delimiter)
    .map((entry) => entry.trim())
    .filter(Boolean);
  const fallbackEntries = [
    path.join(os.homedir(), '.bun', 'bin'),
    path.join(os.homedir(), '.local', 'bin'),
    path.join(os.homedir(), '.npm-global', 'bin'),
    '/opt/homebrew/bin',
    '/usr/local/bin',
    '/usr/bin',
    '/bin'
  ];

  return [...new Set([...pathEntries, ...fallbackEntries])];
}

function getWindowsExecutableNames(command: string): string[] {
  const pathExtensions = (process.env.PATHEXT ?? '.EXE;.CMD;.BAT;.COM')
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean);

  return [command, ...pathExtensions.map((extension) => `${command}${extension.toLowerCase()}`)];
}

async function isExecutableFile(candidatePath: string): Promise<boolean> {
  try {
    await access(candidatePath, fsConstants.X_OK);
    return true;
  } catch {
    return false;
  }
}
