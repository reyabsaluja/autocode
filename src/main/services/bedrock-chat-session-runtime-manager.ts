import { rm } from 'node:fs/promises';

import { query, deleteSession as deleteSdkSession } from '@anthropic-ai/claude-agent-sdk';
import type {
  SDKMessage,
  SDKPartialAssistantMessage,
  SDKResultSuccess,
  SDKSystemMessage,
  SDKUserMessage,
  Query,
  Options
} from '@anthropic-ai/claude-agent-sdk';

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
import { isEnvKeyDenied } from './agent-session-provider';
import { createPermissionService } from './permission-service';

const BEDROCK_MODEL = 'us.anthropic.claude-opus-4-7';

type AgentSessionEventPublisher = (event: AgentSessionEvent) => void;

interface BedrockChatSessionRuntime {
  awsCredentials: { accessKeyId: string; secretAccessKey: string; region: string } | undefined;
  cwd: string;
  customEnvVars: string | undefined;
  disablePromptCaching: boolean;
  model: string;
  systemPrompt: string | undefined;
  activeQuery: Query | null;
  abortController: AbortController | null;
  sdkSessionId: string | null;
}

export function createBedrockChatSessionRuntimeManager({
  agentSessionRepository,
  permissionService,
  publishEvent,
  publishWorkspaceInspectionChange
}: {
  agentSessionRepository: ReturnType<typeof createAgentSessionRepository>;
  permissionService: ReturnType<typeof createPermissionService>;
  publishEvent: AgentSessionEventPublisher;
  publishWorkspaceInspectionChange?: (taskId: number) => void;
}) {
  const runtimes = new Map<number, BedrockChatSessionRuntime>();
  const sessionQueues = new Map<number, Promise<unknown>>();

  return {
    deleteSession,
    reconcileInterruptedChatSessions,
    sendChatMessage,
    startChatSession,
    stopChatSession,
    updateSystemPrompt
  };

  function updateSystemPrompt(sessionId: number, systemPrompt: string | undefined): void {
    const runtime = runtimes.get(sessionId);
    if (runtime) {
      runtime.systemPrompt = systemPrompt;
    }
  }

  async function startChatSession(input: {
    awsCredentials?: { accessKeyId: string; secretAccessKey: string; region: string };
    customEnvVars?: string;
    cwd: string;
    disablePromptCaching?: boolean;
    model?: string;
    reasoningEffort?: string;
    sessionId: number;
    systemPrompt?: string;
    timestamp: string;
    transcriptPath: string;
  }): Promise<AgentSession> {
    await ensureAgentSessionTranscriptFile(input.transcriptPath);

    runtimes.set(input.sessionId, {
      awsCredentials: input.awsCredentials,
      cwd: input.cwd,
      customEnvVars: input.customEnvVars,
      disablePromptCaching: input.disablePromptCaching ?? false,
      model: input.model || BEDROCK_MODEL,
      systemPrompt: input.systemPrompt,
      activeQuery: null,
      abortController: null,
      sdkSessionId: null
    });

    const runningSession = agentSessionRepository.markRunning(
      input.sessionId,
      process.pid,
      input.timestamp
    );

    await appendSystemEntryIfPossible(
      input.sessionId,
      input.transcriptPath,
      'Chat session ready. Send a message to work with Claude (Bedrock) in this worktree.',
      input.timestamp
    );

    return runningSession;
  }

  function buildEnv(runtime: BedrockChatSessionRuntime): Record<string, string | undefined> {
    const env: Record<string, string | undefined> = {
      ...process.env,
      CLAUDE_CODE_USE_BEDROCK: '1',
      ...(runtime.disablePromptCaching ? { DISABLE_PROMPT_CACHING: '1' } : {})
    };

    if (runtime.customEnvVars) {
      for (const line of runtime.customEnvVars.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        if (trimmed.startsWith('unset ')) {
          const key = trimmed.slice(6).trim();
          if (!isEnvKeyDenied(key)) {
            delete env[key];
          }
          continue;
        }

        const withoutExport = trimmed.startsWith('export ') ? trimmed.slice(7) : trimmed;
        const eqIdx = withoutExport.indexOf('=');
        if (eqIdx > 0) {
          const key = withoutExport.slice(0, eqIdx);
          if (isEnvKeyDenied(key)) continue;
          let value = withoutExport.slice(eqIdx + 1);
          if (
            value.length >= 2 &&
            ((value[0] === '"' && value[value.length - 1] === '"') ||
             (value[0] === "'" && value[value.length - 1] === "'"))
          ) {
            value = value.slice(1, -1);
          }
          env[key] = value;
        }
      }
    }

    if (runtime.awsCredentials) {
      env.AWS_ACCESS_KEY_ID = runtime.awsCredentials.accessKeyId;
      env.AWS_SECRET_ACCESS_KEY = runtime.awsCredentials.secretAccessKey;
      env.AWS_REGION = runtime.awsCredentials.region;
    }

    return env;
  }

  async function sendChatMessage(sessionId: number, text: string): Promise<void> {
    const runtime = runtimes.get(sessionId);

    if (!runtime) {
      throw new Error('This chat session is no longer active.');
    }

    if (runtime.activeQuery || runtime.abortController) {
      throw new Error('Claude is still responding to the previous message.');
    }

    const abortController = new AbortController();
    runtime.abortController = abortController;

    const trimmed = text.replace(/\s+$/, '');

    if (!trimmed) {
      runtime.abortController = null;
      return;
    }

    const internalSession = agentSessionRepository.findInternalById(sessionId);

    if (!internalSession) {
      runtime.abortController = null;
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

    const options: Options = {
      abortController,
      cwd: runtime.cwd,
      model: runtime.model,
      env: buildEnv(runtime),
      permissionMode: 'default',
      canUseTool: permissionService.createCanUseToolCallback(sessionId),
      includePartialMessages: true,
      ...(runtime.systemPrompt ? { systemPrompt: runtime.systemPrompt } : {}),
      ...(runtime.sdkSessionId
        ? { resume: runtime.sdkSessionId }
        : {})
    };

    let activeQuery: Query | null = null;

    try {
      await writeTranscriptEntry(sessionId, transcriptPath, 'turn-start', '');

      activeQuery = query({ prompt: trimmed, options });
      runtime.activeQuery = activeQuery;

      let currentAssistantItemId: string | null = null;
      let currentThinkingItemId: string | null = null;
      let inputTokens = 0;
      let outputTokens = 0;
      let cacheReadInputTokens = 0;
      let cacheCreationInputTokens = 0;
      const toolUseMap = new Map<string, ToolUseMeta>();

      for await (const message of activeQuery) {
        if (abortController.signal.aborted) {
          break;
        }

        await handleSDKMessage(
          sessionId,
          transcriptPath,
          message,
          {
            getCurrentAssistantItemId: () => currentAssistantItemId,
            setCurrentAssistantItemId: (id) => { currentAssistantItemId = id; },
            getCurrentThinkingItemId: () => currentThinkingItemId,
            setCurrentThinkingItemId: (id) => { currentThinkingItemId = id; },
            addInputTokens: (n) => { inputTokens += n; },
            addOutputTokens: (n) => { outputTokens += n; },
            addCacheReadInputTokens: (n) => { cacheReadInputTokens += n; },
            addCacheCreationInputTokens: (n) => { cacheCreationInputTokens += n; },
            resetUsage: () => { inputTokens = 0; outputTokens = 0; cacheReadInputTokens = 0; cacheCreationInputTokens = 0; },
            registerToolUse: (id, name, input) => { toolUseMap.set(id, { name, input }); },
            getToolUse: (id) => toolUseMap.get(id),
            captureSessionId: (id) => { runtime.sdkSessionId = id; }
          }
        );
      }

      if (currentAssistantItemId) {
        await writeTranscriptEntry(sessionId, transcriptPath, 'assistant-done', '', currentAssistantItemId);
      }

      await writeTranscriptEntry(
        sessionId,
        transcriptPath,
        'turn-done',
        JSON.stringify({
          inputTokens,
          cachedInputTokens: cacheReadInputTokens,
          outputTokens,
          reasoningOutputTokens: 0
        })
      );
    } catch (error) {
      if (abortController.signal.aborted) {
        return;
      }

      const message =
        error instanceof Error
          ? error.message
          : 'Claude (Bedrock) failed to respond to this chat turn.';
      await writeSystemMessage(sessionId, transcriptPath, message);
    } finally {
      if (runtimes.has(sessionId)) {
        runtime.activeQuery = null;
        runtime.abortController = null;
      }
      if (agentSessionRepository.findById(sessionId)) {
        publishWorkspaceInspectionChange?.(internalSession.taskId);
      }
    }
  }

  interface ToolUseMeta {
    name: string;
    input: Record<string, unknown>;
  }

  interface MessageTracker {
    getCurrentAssistantItemId: () => string | null;
    setCurrentAssistantItemId: (id: string | null) => void;
    getCurrentThinkingItemId: () => string | null;
    setCurrentThinkingItemId: (id: string | null) => void;
    addInputTokens: (n: number) => void;
    addOutputTokens: (n: number) => void;
    addCacheReadInputTokens: (n: number) => void;
    addCacheCreationInputTokens: (n: number) => void;
    resetUsage: () => void;
    registerToolUse: (id: string, name: string, input: Record<string, unknown>) => void;
    getToolUse: (id: string) => ToolUseMeta | undefined;
    captureSessionId: (id: string) => void;
  }

  async function handleSDKMessage(
    sessionId: number,
    transcriptPath: string,
    message: SDKMessage,
    tracker: MessageTracker
  ): Promise<void> {
    switch (message.type) {
      case 'assistant': {
        const assistantMsg = message;

        if (assistantMsg.message.usage) {
          tracker.addInputTokens(assistantMsg.message.usage.input_tokens);
          tracker.addOutputTokens(assistantMsg.message.usage.output_tokens);
          const usage = assistantMsg.message.usage as unknown as Record<string, unknown>;
          tracker.addCacheReadInputTokens(
            (typeof usage.cache_read_input_tokens === 'number' ? usage.cache_read_input_tokens : 0)
          );
          tracker.addCacheCreationInputTokens(
            (typeof usage.cache_creation_input_tokens === 'number' ? usage.cache_creation_input_tokens : 0)
          );
        }

        for (const block of assistantMsg.message.content) {
          if (block.type === 'text') {
            const currentStreamId = tracker.getCurrentAssistantItemId();

            if (currentStreamId && currentStreamId.startsWith('bedrock-stream-')) {
              continue;
            }

            const itemId = `bedrock-msg-${message.uuid}`;

            if (currentStreamId && currentStreamId !== itemId) {
              await writeTranscriptEntry(sessionId, transcriptPath, 'assistant-done', '', currentStreamId);
            }

            tracker.setCurrentAssistantItemId(itemId);
            await writeTranscriptEntry(sessionId, transcriptPath, 'assistant-delta', block.text, itemId);
          } else if (block.type === 'thinking') {
            const thinkingId = `bedrock-think-${message.uuid}`;
            tracker.setCurrentThinkingItemId(thinkingId);
            const thinkingText = 'thinking' in block && typeof block.thinking === 'string' ? block.thinking : '';
            await writeTranscriptEntry(sessionId, transcriptPath, 'thinking', thinkingText, thinkingId);
          } else if (block.type === 'tool_use') {
            const toolId = `bedrock-tool-${block.id}`;
            tracker.registerToolUse(block.id, block.name, block.input as Record<string, unknown>);

            if (tracker.getCurrentAssistantItemId()) {
              await writeTranscriptEntry(sessionId, transcriptPath, 'assistant-done', '', tracker.getCurrentAssistantItemId()!);
              tracker.setCurrentAssistantItemId(null);
            }

            await writeTranscriptEntry(
              sessionId,
              transcriptPath,
              'tool-start',
              JSON.stringify(buildToolStartPayload(block.name, block.input as Record<string, unknown>)),
              toolId
            );
          }
        }

        break;
      }

      case 'stream_event': {
        const streamMsg = message as SDKPartialAssistantMessage;
        const event = streamMsg.event;

        if (!event) {
          break;
        }

        if (event.type === 'content_block_delta') {
          const delta = 'delta' in event ? event.delta : undefined;

          if (delta && delta.type === 'text_delta' && 'text' in delta && typeof delta.text === 'string') {
            const itemId = tracker.getCurrentAssistantItemId() || `bedrock-stream-${message.uuid}`;
            tracker.setCurrentAssistantItemId(itemId);
            await writeTranscriptEntry(sessionId, transcriptPath, 'assistant-delta', delta.text, itemId);
          } else if (delta && delta.type === 'thinking_delta' && 'thinking' in delta && typeof delta.thinking === 'string') {
            const thinkingId = tracker.getCurrentThinkingItemId() || `bedrock-think-${message.uuid}`;
            tracker.setCurrentThinkingItemId(thinkingId);
            await writeTranscriptEntry(sessionId, transcriptPath, 'thinking', delta.thinking, thinkingId);
          }
        }

        break;
      }

      case 'user': {
        const userMsg = message as SDKUserMessage;
        const content = userMsg.message?.content;

        if (Array.isArray(content)) {
          for (const block of content) {
            if (typeof block === 'object' && block !== null && 'type' in block && block.type === 'tool_result') {
              const toolResult = block as { type: 'tool_result'; tool_use_id: string; content?: unknown; is_error?: boolean };
              const toolId = `bedrock-tool-${toolResult.tool_use_id}`;
              const toolMeta = tracker.getToolUse(toolResult.tool_use_id);
              const resultText = typeof toolResult.content === 'string'
                ? toolResult.content
                : Array.isArray(toolResult.content)
                  ? toolResult.content.map((c) => (typeof c === 'object' && c !== null && 'text' in c ? String((c as { text: unknown }).text) : '')).join('')
                  : JSON.stringify(toolResult.content ?? '');

              await writeTranscriptEntry(
                sessionId,
                transcriptPath,
                'tool-done',
                JSON.stringify(
                  buildToolDonePayload(
                    toolMeta?.name ?? 'unknown',
                    toolMeta?.input ?? {},
                    resultText,
                    Boolean(toolResult.is_error)
                  )
                ),
                toolId
              );
            }
          }
        }

        break;
      }

      case 'result': {
        const resultMsg = message as SDKResultSuccess;

        if (resultMsg.usage) {
          tracker.resetUsage();
          tracker.addInputTokens(resultMsg.usage.input_tokens ?? 0);
          tracker.addOutputTokens(resultMsg.usage.output_tokens ?? 0);
          const usage = resultMsg.usage as Record<string, unknown>;
          tracker.addCacheReadInputTokens(typeof usage.cache_read_input_tokens === 'number' ? usage.cache_read_input_tokens : 0);
          tracker.addCacheCreationInputTokens(typeof usage.cache_creation_input_tokens === 'number' ? usage.cache_creation_input_tokens : 0);
        }

        break;
      }

      case 'system': {
        const sysMsg = message as SDKSystemMessage;

        if (sysMsg.subtype === 'init' && sysMsg.session_id) {
          tracker.captureSessionId(sysMsg.session_id);
          break;
        }

        break;
      }

      default:
        break;
    }
  }

  function buildToolStartPayload(name: string, input: Record<string, unknown>): Record<string, unknown> {
    switch (name) {
      case 'Bash':
        return {
          type: 'bash',
          toolName: 'Bash',
          command: (input.command as string) ?? '',
          status: 'running'
        };
      case 'Read':
        return {
          type: 'read_file',
          toolName: 'Read',
          filePath: (input.file_path as string) ?? '',
          status: 'running'
        };
      case 'Edit':
        return {
          type: 'edit_file',
          toolName: 'Edit',
          filePath: (input.file_path as string) ?? '',
          oldString: (input.old_string as string) ?? '',
          newString: (input.new_string as string) ?? '',
          status: 'running'
        };
      case 'Write':
        return {
          type: 'write_file',
          toolName: 'Write',
          filePath: (input.file_path as string) ?? '',
          status: 'running'
        };
      case 'Glob':
        return {
          type: 'glob',
          toolName: 'Glob',
          pattern: (input.pattern as string) ?? '',
          status: 'running'
        };
      case 'Grep':
        return {
          type: 'grep',
          toolName: 'Grep',
          pattern: (input.pattern as string) ?? '',
          filePath: (input.path as string) ?? '',
          status: 'running'
        };
      case 'WebSearch':
        return {
          type: 'web_search',
          toolName: 'WebSearch',
          query: (input.query as string) ?? '',
          status: 'running'
        };
      case 'WebFetch':
        return {
          type: 'web_fetch',
          toolName: 'WebFetch',
          url: (input.url as string) ?? '',
          status: 'running'
        };
      default:
        return {
          type: 'command',
          toolName: name,
          command: `${name}: ${JSON.stringify(input).slice(0, 200)}`,
          status: 'running'
        };
    }
  }

  function buildToolDonePayload(
    name: string,
    input: Record<string, unknown>,
    output: string,
    isError: boolean
  ): Record<string, unknown> {
    const base = buildToolStartPayload(name, input);
    base.status = isError ? 'error' : 'completed';
    base.output = output;
    base.exitCode = isError ? 1 : 0;
    return base;
  }

  async function stopChatSession(sessionId: number): Promise<void> {
    const runtime = runtimes.get(sessionId);

    if (!runtime) {
      return;
    }

    permissionService.clearSession(sessionId);

    if (runtime.abortController) {
      runtime.abortController.abort();
    }

    runtimes.delete(sessionId);

    const session = agentSessionRepository.findInternalById(sessionId);
    if (session && (session.status === 'starting' || session.status === 'running')) {
      const nextSession = agentSessionRepository.finalize({
        endedAt: new Date().toISOString(),
        exitCode: null,
        lastError: null,
        sessionId,
        status: 'terminated'
      });
      emitSnapshot(nextSession);
    }
  }

  async function deleteSession(sessionId: number): Promise<void> {
    const runtime = runtimes.get(sessionId);
    const session = agentSessionRepository.findInternalById(sessionId);

    if (!session) {
      return;
    }

    permissionService.clearSession(sessionId);

    if (runtime?.abortController) {
      runtime.abortController.abort();
    }

    if (runtime?.sdkSessionId) {
      deleteSdkSession(runtime.sdkSessionId).catch(() => {});
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
      if (session.surface !== 'chat' || session.provider !== 'claude-bedrock') {
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
    const next = previous.catch(() => undefined).then(work);
    const settled = next.then(() => undefined, () => undefined);
    sessionQueues.set(sessionId, settled);

    try {
      return await next;
    } finally {
      if (sessionQueues.get(sessionId) === settled) {
        sessionQueues.delete(sessionId);
      }
    }
  }
}
