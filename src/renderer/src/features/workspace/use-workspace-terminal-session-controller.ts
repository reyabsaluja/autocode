import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { AgentProvider } from '@shared/domain/agent-session';
import type { TaskWorkspace } from '@shared/domain/task-workspace';

import {
  useDeleteAgentSessionMutation,
  useAgentSessionInputMutation,
  useAgentSessionResizeMutation,
  useAgentSessionStream,
  useAgentSessionTranscriptTailQuery,
  useAgentSessionsQuery,
  useStartAgentSessionMutation,
  useStopAgentSessionMutation
} from '../agent-sessions/agent-session-hooks';
import type { AgentSessionTranscriptEntry } from '@shared/domain/agent-session';
import { useCreateTaskWorkspaceMutation } from '../tasks/task-hooks';
import { autocodeApi } from '../../lib/autocode-api';
import {
  DEFAULT_TERMINAL_SIZE,
  formatWorkspaceInspectorError,
  getProviderDisplayName,
  getSessionTabDisplayName,
  isActiveSessionStatus,
  NEW_TAB_CHAT_OPTION,
  TERMINAL_TAB_ID,
  type NewTabOption,
  type WorkspaceCenterTransitionRequest
} from './workspace-inspector-shared';
import { useChatProviderStore } from '../../stores/chat-provider-store';
import { useProviderSettingsStore } from '../../stores/provider-settings-store';

const EMPTY_ENTRIES: AgentSessionTranscriptEntry[] = [];

interface UseWorkspaceTerminalSessionControllerInput {
  activeCenterTab: string;
  onRequestTaskSelection: (taskId: number) => void;
  showTerminal: () => void;
  taskId: number;
  taskWorkspace: TaskWorkspace;
  runWithCenterTransition: (input: WorkspaceCenterTransitionRequest) => void;
}

export function useWorkspaceTerminalSessionController({
  activeCenterTab,
  onRequestTaskSelection,
  showTerminal,
  taskId,
  taskWorkspace,
  runWithCenterTransition
}: UseWorkspaceTerminalSessionControllerInput) {
  const sessionsQuery = useAgentSessionsQuery(taskId);
  const sessions = sessionsQuery.data ?? [];
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [terminalSize, setTerminalSize] = useState(DEFAULT_TERMINAL_SIZE);
  const [isolatedLaunchError, setIsolatedLaunchError] = useState<string | null>(null);
  const [isLaunchingIsolatedSession, setIsLaunchingIsolatedSession] = useState(false);
  const lastReportedTerminalSizeRef = useRef(DEFAULT_TERMINAL_SIZE);
  const createTaskWorkspaceMutation = useCreateTaskWorkspaceMutation(taskWorkspace.task.projectId);
  const { activeAiSessions, activeSession, selectedSession, sessionById } = useMemo(() => {
    const nextSessionById = new Map<number, (typeof sessions)[number]>();
    const nextActiveAiSessions: typeof sessions = [];
    let nextActiveSession: (typeof sessions)[number] | null = null;

    for (const session of sessions) {
      nextSessionById.set(session.id, session);

      if (!isActiveSessionStatus(session.status)) {
        continue;
      }

      if (!nextActiveSession) {
        nextActiveSession = session;
      }

      if (session.provider !== 'terminal') {
        nextActiveAiSessions.push(session);
      }
    }

    return {
      activeAiSessions: nextActiveAiSessions,
      activeSession: nextActiveSession,
      selectedSession: selectedSessionId !== null ? nextSessionById.get(selectedSessionId) ?? null : null,
      sessionById: nextSessionById
    };
  }, [selectedSessionId, sessions]);
  const startSessionMutation = useStartAgentSessionMutation(taskId);
  const deleteSessionMutation = useDeleteAgentSessionMutation(taskId);
  const sendInputMutation = useAgentSessionInputMutation(selectedSession?.id ?? null);
  const stopSessionMutation = useStopAgentSessionMutation();
  const resizeSessionMutation = useAgentSessionResizeMutation(selectedSession?.id ?? null);
  const transcriptQuery = useAgentSessionTranscriptTailQuery(
    selectedSession?.id ?? null,
    selectedSession !== null
  );
  const terminalErrorMessage =
    isolatedLaunchError ??
    formatWorkspaceInspectorError(startSessionMutation.error) ??
    formatWorkspaceInspectorError(sendInputMutation.error) ??
    formatWorkspaceInspectorError(deleteSessionMutation.error) ??
    formatWorkspaceInspectorError(transcriptQuery.error) ??
    formatWorkspaceInspectorError(sessionsQuery.error);

  useAgentSessionStream(taskId);

  useEffect(() => {
    setSelectedSessionId(null);
    setTerminalSize(DEFAULT_TERMINAL_SIZE);
    setIsolatedLaunchError(null);
    lastReportedTerminalSizeRef.current = DEFAULT_TERMINAL_SIZE;
  }, [taskId]);

  useEffect(() => {
    if (!sessions.length) {
      setSelectedSessionId(null);
      return;
    }

    if (selectedSessionId !== null && sessionById.has(selectedSessionId)) {
      return;
    }

    setSelectedSessionId(activeSession?.id ?? null);
  }, [activeSession?.id, selectedSessionId, sessionById, sessions.length]);

  function requestSessionSelection(sessionId: number) {
    if (activeCenterTab === TERMINAL_TAB_ID && selectedSessionId === sessionId) {
      return;
    }

    runWithCenterTransition({
      body: 'Save or discard your changes to the current file before switching sessions.',
      key: `session:${taskId}:${sessionId}`,
      run: () => {
        showTerminal();
        setSelectedSessionId(sessionId);
      },
      title: 'Unsaved file edits'
    });
  }

  function requestStartSession(option: NewTabOption) {
    const isChat = option.kind === 'chat';
    const shouldOfferIsolation =
      !isChat && option.provider !== 'terminal' && activeAiSessions.length > 0;
    const displayName = getSessionTabDisplayName(option.provider, option.surface);

    runWithCenterTransition({
      body: shouldOfferIsolation
        ? 'Save or discard your changes to the current file before launching another AI agent.'
        : 'Save or discard your changes to the current file before starting a new session.',
      key: `session:start:${taskId}:${option.id}:${sessions.length}`,
      run: () => {
        setIsolatedLaunchError(null);

        if (shouldOfferIsolation) {
          const confirmed = window.confirm(
            `Agent tabs in this task share one git worktree.\n\nSelect OK to create a new isolated task workspace for ${displayName} from "${taskWorkspace.task.title}"'s current branch.\n\nUncommitted changes stay in the current workspace.\n\nSelect Cancel to keep ${displayName} in the current shared workspace.`
          );

          if (confirmed) {
            void launchIsolatedSession(option);
            return;
          }
        }

        showTerminal();
        void startSession(option);
      },
      title: 'Unsaved file edits'
    });
  }

  async function startSession(option: NewTabOption) {
    const chatState = useChatProviderStore.getState();
    const effectiveProvider = option.kind === 'chat' ? chatState.chatProvider : option.provider;
    const providerSettings = useProviderSettingsStore.getState();
    const session = await startSessionMutation.mutateAsync({
      ...terminalSize,
      awsCredentials: effectiveProvider === 'claude-bedrock' ? chatState.awsCredentials : undefined,
      customEnvVars: providerSettings.claudeCodeEnvVars || undefined,
      model: option.kind === 'chat' ? chatState.chatModel : undefined,
      provider: effectiveProvider,
      reasoningEffort: option.kind === 'chat' ? chatState.reasoningEffort : undefined,
      surface: option.surface
    });
    setSelectedSessionId(session.id);
  }

  async function launchIsolatedSession(option: NewTabOption) {
    setIsLaunchingIsolatedSession(true);
    const displayName = getSessionTabDisplayName(option.provider, option.surface);

    try {
      const workspace = await createTaskWorkspaceMutation.mutateAsync({
        baseTaskId: taskWorkspace.task.id,
        description: taskWorkspace.task.description ?? '',
        title: buildIsolatedAgentTaskTitle(taskWorkspace.task.title, option.provider)
      });

      await autocodeApi.agentSessions.start({
        ...terminalSize,
        provider: option.provider,
        surface: option.surface,
        taskId: workspace.task.id
      });

      onRequestTaskSelection(workspace.task.id);
    } catch (error) {
      setIsolatedLaunchError(
        error instanceof Error
          ? error.message
          : `Autocode could not start ${displayName} in a new isolated task workspace.`
      );
    } finally {
      setIsLaunchingIsolatedSession(false);
    }
  }

  function requestDeleteSession(sessionId: number) {
    const session = sessionById.get(sessionId) ?? null;

    if (!session) {
      return;
    }

    const displayName = getProviderDisplayName(session.provider);
    const confirmed = window.confirm(
      isActiveSessionStatus(session.status)
        ? `Delete this ${displayName} session?\n\nThis will terminate the active session and remove its transcript.`
        : `Delete this ${displayName} session and remove its transcript?`
    );

    if (!confirmed) {
      return;
    }

    if (selectedSessionId === sessionId) {
      let nextSelectedSession: (typeof sessions)[number] | null = null;

      for (let index = 0; index < sessions.length; index += 1) {
        const entry = sessions[index]!;

        if (entry.id !== sessionId) {
          nextSelectedSession = entry;
          break;
        }
      }

      setSelectedSessionId(nextSelectedSession?.id ?? null);
    }

    void deleteSessionMutation.mutateAsync(sessionId).catch((error) => {
      window.alert(
        error instanceof Error ? error.message : `Autocode could not delete this ${displayName} session.`
      );
    });
  }

  const selectedSessionRef = useRef(selectedSession);
  selectedSessionRef.current = selectedSession;

  const handleTerminalResize = useCallback((cols: number, rows: number) => {
    if (
      lastReportedTerminalSizeRef.current.cols === cols &&
      lastReportedTerminalSizeRef.current.rows === rows
    ) {
      return;
    }

    lastReportedTerminalSizeRef.current = { cols, rows };
    setTerminalSize({ cols, rows });

    if (selectedSessionRef.current && isActiveSessionStatus(selectedSessionRef.current.status)) {
      resizeSessionMutation.mutate({ cols, rows });
    }
  }, [resizeSessionMutation]);

  const handleTerminalData = useCallback((text: string) => {
    if (isActiveSessionStatus(selectedSessionRef.current?.status)) {
      sendInputMutation.mutate({ text });
    }
  }, [sendInputMutation]);

  const entries = transcriptQuery.data?.entries ?? EMPTY_ENTRIES;

  const handleChatSend = useCallback((text: string) => {
    const current = selectedSessionRef.current;

    if (!current || !isActiveSessionStatus(current.status)) {
      return;
    }

    sendInputMutation.mutate({ text });
  }, [sendInputMutation]);

  const handleChatStop = useCallback(() => {
    const current = selectedSessionRef.current;

    if (!current || !isActiveSessionStatus(current.status)) {
      return;
    }

    stopSessionMutation.mutate(current.id);
  }, [stopSessionMutation]);

  const emptyStateMode = useMemo<'idle' | 'selectSession' | 'starting'>(() => {
    if (startSessionMutation.isPending) {
      return 'starting';
    }

    return sessions.length > 0 ? 'selectSession' : 'idle';
  }, [sessions.length, startSessionMutation.isPending]);

  const terminalSurfaceProps = useMemo(() => ({
    emptyStateMode,
    entries,
    errorMessage: terminalErrorMessage,
    isInteractive: isActiveSessionStatus(selectedSession?.status),
    onData: handleTerminalData,
    onResize: handleTerminalResize,
    sessionId: selectedSession?.id ?? null
  }), [
    emptyStateMode,
    entries,
    handleTerminalData,
    handleTerminalResize,
    selectedSession?.id,
    selectedSession?.status,
    terminalErrorMessage
  ]);

  const handleStartNewChat = useCallback(() => {
    const current = selectedSessionRef.current;

    if (current && current.surface === 'chat' && isActiveSessionStatus(current.status)) {
      stopSessionMutation.mutate(current.id);
    }

    showTerminal();
    void startSession(NEW_TAB_CHAT_OPTION);
  }, [showTerminal, stopSessionMutation, startSessionMutation, terminalSize]);

  const chatSurfaceProps = useMemo(() => ({
    emptyStateMode,
    entries,
    errorMessage: terminalErrorMessage,
    isInteractive: isActiveSessionStatus(selectedSession?.status),
    onSend: handleChatSend,
    onStartNewChat: handleStartNewChat,
    onStop: handleChatStop,
    provider: selectedSession?.provider,
    sessionId: selectedSession?.id ?? null
  }), [
    emptyStateMode,
    entries,
    handleChatSend,
    handleChatStop,
    handleStartNewChat,
    selectedSession?.id,
    selectedSession?.provider,
    selectedSession?.status,
    terminalErrorMessage
  ]);

  return {
    chatSurfaceProps,
    deleteSessionMutation,
    requestDeleteSession,
    requestStartSession,
    requestSessionSelection,
    resizeSessionMutation,
    selectedSession,
    selectedSessionId,
    sendInputMutation,
    sessions,
    sessionsQuery,
    startSessionMutation,
    startSessionPending: startSessionMutation.isPending || isLaunchingIsolatedSession,
    terminalErrorMessage,
    terminalSurfaceProps,
    transcriptQuery
  };
}

export type WorkspaceTerminalSessionController = ReturnType<typeof useWorkspaceTerminalSessionController>;

function buildIsolatedAgentTaskTitle(currentTitle: string, provider: AgentProvider): string {
  const providerLabel = getProviderDisplayName(provider);
  const baseTitle = currentTitle.trim();
  const suffix = ` (${providerLabel} isolated)`;
  const nextTitle = baseTitle.endsWith(suffix) ? baseTitle : `${baseTitle}${suffix}`;

  return nextTitle.slice(0, 160);
}
