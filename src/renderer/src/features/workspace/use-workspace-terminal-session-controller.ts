import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { AgentProvider } from '@shared/domain/agent-session';

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
  showTerminal: () => void;
  taskId: number;
  runWithCenterTransition: (input: WorkspaceCenterTransitionRequest) => void;
}

export function useWorkspaceTerminalSessionController({
  activeCenterTab,
  showTerminal,
  taskId,
  runWithCenterTransition
}: UseWorkspaceTerminalSessionControllerInput) {
  const sessionsQuery = useAgentSessionsQuery(taskId);
  const sessions = sessionsQuery.data ?? [];
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [terminalSize, setTerminalSize] = useState(DEFAULT_TERMINAL_SIZE);
  const lastReportedTerminalSizeRef = useRef(DEFAULT_TERMINAL_SIZE);
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
    formatWorkspaceInspectorError(startSessionMutation.error) ??
    formatWorkspaceInspectorError(deleteSessionMutation.error) ??
    formatWorkspaceInspectorError(terminateSessionMutation.error) ??
    formatWorkspaceInspectorError(transcriptQuery.error) ??
    formatWorkspaceInspectorError(sessionsQuery.error);

  useAgentSessionStream(taskId);

  useEffect(() => {
    setSelectedSessionId(null);
    setTerminalSize(DEFAULT_TERMINAL_SIZE);
    lastReportedTerminalSizeRef.current = DEFAULT_TERMINAL_SIZE;
  }, [taskId]);

  useEffect(() => {
    if (!sessions.length) {
      setSelectedSessionId(null);
      return;
    }

    if (
      selectedSessionId === null ||
      !sessions.some((session) => session.id === selectedSessionId)
    ) {
      setSelectedSessionId(sessions[0]?.id ?? null);
    }
  }, [selectedSessionId, sessions]);

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
    runWithCenterTransition({
      body: 'Save or discard your changes to the current file before starting a new session.',
      key: `session:start:${taskId}:${provider}:${sessions.length}`,
      run: () => {
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
    emptyStateMode: startSessionMutation.isPending ? ('starting' as const) : ('idle' as const),
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
    terminateSessionMutation,
    terminalErrorMessage,
    terminalSurfaceProps,
    transcriptQuery
  };
}

export type WorkspaceTerminalSessionController = ReturnType<typeof useWorkspaceTerminalSessionController>;
