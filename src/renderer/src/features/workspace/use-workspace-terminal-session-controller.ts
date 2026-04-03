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
  useTerminateAgentSessionMutation
} from '../agent-sessions/agent-session-hooks';
import type { AgentSessionTranscriptEntry } from '@shared/domain/agent-session';
import { useCreateTaskWorkspaceMutation } from '../tasks/task-hooks';
import { autocodeApi } from '../../lib/autocode-api';
import {
  DEFAULT_TERMINAL_SIZE,
  formatWorkspaceInspectorError,
  getProviderDisplayName,
  isActiveSessionStatus,
  TERMINAL_TAB_ID,
  type WorkspaceCenterTransitionRequest
} from './workspace-inspector-shared';

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
  const activeSession = useMemo(
    () => sessions.find((session) => isActiveSessionStatus(session.status)) ?? null,
    [sessions]
  );
  const activeAiSessions = useMemo(
    () =>
      sessions.filter(
        (session) => session.provider !== 'terminal' && isActiveSessionStatus(session.status)
      ),
    [sessions]
  );
  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === selectedSessionId) ?? null,
    [selectedSessionId, sessions]
  );
  const selectedSessionIsActive = selectedSession !== null && isActiveSessionStatus(selectedSession.status);
  const startSessionMutation = useStartAgentSessionMutation(taskId);
  const deleteSessionMutation = useDeleteAgentSessionMutation(taskId);
  const terminateSessionMutation = useTerminateAgentSessionMutation(selectedSession?.id ?? null);
  const sendInputMutation = useAgentSessionInputMutation(selectedSession?.id ?? null);
  const resizeSessionMutation = useAgentSessionResizeMutation(selectedSession?.id ?? null);
  const transcriptQuery = useAgentSessionTranscriptTailQuery(
    selectedSession?.id ?? null,
    selectedSession !== null
  );
  const terminalErrorMessage =
    isolatedLaunchError ??
    formatWorkspaceInspectorError(startSessionMutation.error) ??
    formatWorkspaceInspectorError(deleteSessionMutation.error) ??
    formatWorkspaceInspectorError(terminateSessionMutation.error) ??
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

    if (selectedSessionId !== null && sessions.some((session) => session.id === selectedSessionId)) {
      return;
    }

    setSelectedSessionId(activeSession?.id ?? null);
  }, [activeSession?.id, selectedSessionId, sessions]);

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

  function requestStartSession(provider: AgentProvider) {
    const shouldOfferIsolation = provider !== 'terminal' && activeAiSessions.length > 0;

    runWithCenterTransition({
      body: shouldOfferIsolation
        ? 'Save or discard your changes to the current file before launching another AI agent.'
        : 'Save or discard your changes to the current file before starting a new session.',
      key: `session:start:${taskId}:${provider}:${sessions.length}`,
      run: () => {
        setIsolatedLaunchError(null);

        if (shouldOfferIsolation) {
          const confirmed = window.confirm(
            `Agent tabs in this task share one git worktree.\n\nSelect OK to create a new isolated task workspace for ${getProviderDisplayName(provider)} from "${taskWorkspace.task.title}"'s current branch.\n\nUncommitted changes stay in the current workspace.\n\nSelect Cancel to keep ${getProviderDisplayName(provider)} in the current shared workspace.`
          );

          if (confirmed) {
            void launchIsolatedSession(provider);
            return;
          }
        }

        showTerminal();
        void startSession(provider);
      },
      title: 'Unsaved file edits'
    });
  }

  async function startSession(provider: AgentProvider) {
    const session = await startSessionMutation.mutateAsync({ ...terminalSize, provider });
    setSelectedSessionId(session.id);
  }

  async function launchIsolatedSession(provider: AgentProvider) {
    setIsLaunchingIsolatedSession(true);

    try {
      const workspace = await createTaskWorkspaceMutation.mutateAsync({
        baseTaskId: taskWorkspace.task.id,
        description: taskWorkspace.task.description ?? '',
        title: buildIsolatedAgentTaskTitle(taskWorkspace.task.title, provider)
      });

      await autocodeApi.agentSessions.start({
        ...terminalSize,
        provider,
        taskId: workspace.task.id
      });

      onRequestTaskSelection(workspace.task.id);
    } catch (error) {
      setIsolatedLaunchError(
        error instanceof Error
          ? error.message
          : `Autocode could not start ${getProviderDisplayName(provider)} in a new isolated task workspace.`
      );
    } finally {
      setIsLaunchingIsolatedSession(false);
    }
  }

  function requestDeleteSession(sessionId: number) {
    const session = sessions.find((entry) => entry.id === sessionId) ?? null;

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
      const nextSelectedSession =
        sessions.find((entry) => entry.id !== sessionId) ?? null;

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

  const terminalSurfaceProps = useMemo(() => ({
    emptyStateMode: startSessionMutation.isPending
      ? ('starting' as const)
      : sessions.length > 0
        ? ('selectSession' as const)
        : ('idle' as const),
    entries,
    errorMessage: terminalErrorMessage,
    isInteractive: isActiveSessionStatus(selectedSession?.status),
    onData: handleTerminalData,
    onResize: handleTerminalResize,
    sessionId: selectedSession?.id ?? null
  }), [
    entries,
    handleTerminalData,
    handleTerminalResize,
    selectedSession?.id,
    selectedSession?.status,
    sessions.length,
    startSessionMutation.isPending,
    terminalErrorMessage
  ]);

  return {
    deleteSessionMutation,
    requestDeleteSession,
    requestStartSession,
    requestSessionSelection,
    resizeSessionMutation,
    selectedSession,
    selectedSessionId,
    selectedSessionIsActive,
    sendInputMutation,
    sessions,
    sessionsQuery,
    startSessionMutation,
    startSessionPending: startSessionMutation.isPending || isLaunchingIsolatedSession,
    terminateSessionMutation,
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
