import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Bot, ChevronDown, FileCode2, Files, GitCompare, Plus, RefreshCw, Square, Terminal, X } from 'lucide-react';

import type { AgentProvider, AgentSessionStatus } from '@shared/domain/agent-session';
import type { TaskWorkspace } from '@shared/domain/task-workspace';
import type { WorkspaceChange } from '@shared/domain/workspace-inspection';

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
import { WorkspaceTerminalSurface } from '../agent-sessions/workspace-terminal-surface';
import { UnsavedChangesDialog } from '../editor/unsaved-changes-dialog';
import { useUnsavedChangesGuard } from '../editor/use-unsaved-changes-guard';
import {
  WorkspaceEditorSurface,
  type WorkspaceEditorHandle
} from '../editor/workspace-editor-surface';
import { queryKeys } from '../../lib/query-keys';
import {
  useCommitWorkspaceMutation,
  useWorkspaceChangesQuery
} from './workspace-hooks';
import { WorkspaceChangesPanel } from './workspace-changes-panel';
import { WorkspaceFileExplorer } from './workspace-file-explorer';

interface WorkspaceInspectorProps {
  taskWorkspace: TaskWorkspace;
}

interface WorkspaceFileTab {
  mode: 'diff' | 'editor';
  path: string;
  selectionMode: 'changes' | 'files';
}

const TERMINAL_TAB_ID = '__terminal__';
const ACTIVE_WORKSPACE_REFRESH_INTERVAL_MS = 2_000;
const DEFAULT_TERMINAL_SIZE = {
  cols: 120,
  rows: 30
};

export const WorkspaceInspector = forwardRef<WorkspaceEditorHandle, WorkspaceInspectorProps>(
function WorkspaceInspector({ taskWorkspace }: WorkspaceInspectorProps, ref) {
  const queryClient = useQueryClient();
  const editorRef = useRef<WorkspaceEditorHandle | null>(null);
  const taskId = taskWorkspace.task.id;
  const changesQuery = useWorkspaceChangesQuery(taskId);
  const commitMutation = useCommitWorkspaceMutation(taskId);
  const sessionsQuery = useAgentSessionsQuery(taskId);
  const [activeSidebarTab, setActiveSidebarTab] = useState<'changes' | 'files'>('files');
  const [activeCenterTab, setActiveCenterTab] = useState<string>(TERMINAL_TAB_ID);
  const [fileTabs, setFileTabs] = useState<WorkspaceFileTab[]>([]);
  const [expandedDirectories, setExpandedDirectories] = useState<string[]>([]);
  const [commitMessage, setCommitMessage] = useState('');
  const [commitNotice, setCommitNotice] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [isNewSessionMenuOpen, setIsNewSessionMenuOpen] = useState(false);
  const newSessionMenuRef = useRef<HTMLDivElement | null>(null);
  const [terminalSize, setTerminalSize] = useState(DEFAULT_TERMINAL_SIZE);
  const lastReportedTerminalSizeRef = useRef(DEFAULT_TERMINAL_SIZE);
  const previousActiveSessionIdRef = useRef<number | null>(null);
  const changes = changesQuery.data?.changes ?? [];
  const commits = changesQuery.data?.commits ?? [];
  const sessions = sessionsQuery.data ?? [];
  const activeSession = useMemo(
    () => sessions.find((session) => isActiveSessionStatus(session.status)) ?? null,
    [sessions]
  );
  const startSessionMutation = useStartAgentSessionMutation(taskId);
  const deleteSessionMutation = useDeleteAgentSessionMutation(taskId);
  const { dialogProps: fileSwitchDialogProps, requestTransition: requestFileTransition } =
    useUnsavedChangesGuard(editorRef);
  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === selectedSessionId) ?? null,
    [selectedSessionId, sessions]
  );
  const selectedSessionIsActive = selectedSession !== null && isActiveSessionStatus(selectedSession.status);
  const terminateSessionMutation = useTerminateAgentSessionMutation(selectedSession?.id ?? null);
  const sendInputMutation = useAgentSessionInputMutation(selectedSession?.id ?? null);
  const resizeSessionMutation = useAgentSessionResizeMutation(selectedSession?.id ?? null);
  const transcriptQuery = useAgentSessionTranscriptTailQuery(
    selectedSession?.id ?? null,
    selectedSession !== null
  );
  const activeFileTab = useMemo(
    () => fileTabs.find((tab) => tab.path === activeCenterTab) ?? null,
    [activeCenterTab, fileTabs]
  );
  const selectedPath = activeFileTab?.path ?? null;
  const activeChange = useMemo(
    () => changes.find((change) => change.relativePath === selectedPath) ?? null,
    [changes, selectedPath]
  );
  const terminalErrorMessage =
    formatError(startSessionMutation.error) ??
    formatError(deleteSessionMutation.error) ??
    formatError(terminateSessionMutation.error) ??
    formatError(transcriptQuery.error) ??
    formatError(sessionsQuery.error);

  useAgentSessionStream(
    taskId,
    selectedSession?.id ?? null,
    transcriptQuery.isSuccess && isActiveSessionStatus(selectedSession?.status)
  );

  useImperativeHandle(
    ref,
    () => ({
      discardUnsavedChanges: () => editorRef.current?.discardUnsavedChanges(),
      getActiveFilePath: () => editorRef.current?.getActiveFilePath() ?? null,
      hasUnsavedChanges: () => editorRef.current?.hasUnsavedChanges() ?? false,
      saveActiveFile: async () => (await editorRef.current?.saveActiveFile()) ?? false
    }),
    []
  );

  useEffect(() => {
    setActiveSidebarTab('files');
    setActiveCenterTab(TERMINAL_TAB_ID);
    setFileTabs([]);
    setExpandedDirectories([]);
    setCommitMessage('');
    setCommitNotice(null);
    setSelectedSessionId(null);
    setTerminalSize(DEFAULT_TERMINAL_SIZE);
    lastReportedTerminalSizeRef.current = DEFAULT_TERMINAL_SIZE;
    previousActiveSessionIdRef.current = null;
    commitMutation.reset();
  }, [taskId]);

  useEffect(() => {
    const previousActiveSessionId = previousActiveSessionIdRef.current;

    if (!activeSession && previousActiveSessionId !== null) {
      void refreshWorkspaceInspectionQueries(queryClient, taskId);
    }

    if (!sessions.length) {
      setSelectedSessionId(null);
      previousActiveSessionIdRef.current = null;
      return;
    }

    const nextSelectedSession = activeSession ?? sessions[0] ?? null;

    if (
      nextSelectedSession &&
      (selectedSessionId === null || !sessions.some((session) => session.id === selectedSessionId))
    ) {
      setSelectedSessionId(nextSelectedSession.id);
    }

    previousActiveSessionIdRef.current = activeSession?.id ?? null;
  }, [activeSession, queryClient, selectedSessionId, sessions, taskId]);

  useEffect(() => {
    if (!activeSession) {
      return;
    }

    void refreshWorkspaceInspectionQueries(queryClient, taskId);

    const interval = window.setInterval(() => {
      void refreshWorkspaceInspectionQueries(queryClient, taskId);
    }, ACTIVE_WORKSPACE_REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [activeSession?.id, queryClient, taskId]);

  useEffect(() => {
    if (!activeFileTab || activeFileTab.selectionMode !== 'changes') {
      return;
    }

    if (changes.length === 0) {
      if (!editorRef.current?.hasUnsavedChanges()) {
        applyCloseFileTab(activeFileTab.path);
      }

      return;
    }

    if (changes.some((change) => change.relativePath === activeFileTab.path)) {
      return;
    }

    const nextPath = changes[0]?.relativePath ?? null;

    if (!nextPath) {
      return;
    }

    requestFileSelection(nextPath, 'changes', 'diff');
  }, [activeFileTab, changes]);

  useEffect(() => {
    if (!isNewSessionMenuOpen) {
      return;
    }

    function handleClickOutside(event: MouseEvent) {
      if (newSessionMenuRef.current && !newSessionMenuRef.current.contains(event.target as Node)) {
        setIsNewSessionMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isNewSessionMenuOpen]);

  useEffect(() => {
    if (activeSession && isNewSessionMenuOpen) {
      setIsNewSessionMenuOpen(false);
    }
  }, [activeSession, isNewSessionMenuOpen]);

  const handleRefresh = async () => {
    setCommitNotice(null);
    commitMutation.reset();
    await queryClient.invalidateQueries({ queryKey: queryKeys.workspace(taskId) });
  };

  const handleCommit = async () => {
    try {
      const result = await commitMutation.mutateAsync({ message: commitMessage });
      setCommitNotice(`Committed ${result.commitSha.slice(0, 7)} on this workspace branch.`);
      setCommitMessage('');
    } catch {
      // The mutation error is rendered in the panel.
    }
  };

  const toggleDirectory = (directoryPath: string) => {
    setExpandedDirectories((current) =>
      current.includes(directoryPath)
        ? current.filter((entry) => entry !== directoryPath)
        : [...current, directoryPath]
    );
  };

  function requestFileSelection(
    path: string,
    nextSelectionMode: 'changes' | 'files',
    nextCenterMode: 'diff' | 'editor'
  ) {
    if (
      activeFileTab &&
      activeFileTab.path === path &&
      activeFileTab.mode === nextCenterMode &&
      activeCenterTab === path
    ) {
      return;
    }

    requestCenterTransition({
      body: `Save or discard your changes to ${
        editorRef.current?.getActiveFilePath() ?? 'the current file'
      } before opening another tab.`,
      key: `file:${taskId}:${path}:${nextSelectionMode}:${nextCenterMode}`,
      run: () => {
        applyFileSelection(path, nextSelectionMode, nextCenterMode);
      },
      title: 'Unsaved file edits'
    });
  }

  function applyFileSelection(
    path: string,
    nextSelectionMode: 'changes' | 'files',
    nextCenterMode: 'diff' | 'editor'
  ) {
    setFileTabs((current) => {
      const existingTab = current.find((tab) => tab.path === path);

      if (existingTab) {
        return current.map((tab) =>
          tab.path === path
            ? {
                ...tab,
                mode: nextCenterMode,
                selectionMode: nextSelectionMode
              }
            : tab
        );
      }

      return [
        ...current,
        {
          mode: nextCenterMode,
          path,
          selectionMode: nextSelectionMode
        }
      ];
    });
    setActiveCenterTab(path);
  }

  function requestTerminalSelection() {
    if (activeCenterTab === TERMINAL_TAB_ID) {
      return;
    }

    requestCenterTransition({
      body: `Save or discard your changes to ${
        editorRef.current?.getActiveFilePath() ?? 'the current file'
      } before returning to the terminal.`,
      key: `terminal:${taskId}`,
      run: () => {
        setActiveCenterTab(TERMINAL_TAB_ID);
      },
      title: 'Unsaved file edits'
    });
  }

  function requestSessionSelection(sessionId: number) {
    if (activeCenterTab === TERMINAL_TAB_ID && selectedSessionId === sessionId) {
      return;
    }

    requestCenterTransition({
      body: `Save or discard your changes to ${
        editorRef.current?.getActiveFilePath() ?? 'the current file'
      } before switching sessions.`,
      key: `session:${taskId}:${sessionId}`,
      run: () => {
        setSelectedSessionId(sessionId);
        setActiveCenterTab(TERMINAL_TAB_ID);
      },
      title: 'Unsaved file edits'
    });
  }

  function requestStartSession(provider: AgentProvider) {
    setIsNewSessionMenuOpen(false);

    if (activeSession) {
      requestSessionSelection(activeSession.id);
      return;
    }

    requestCenterTransition({
      body: `Save or discard your changes to ${
        editorRef.current?.getActiveFilePath() ?? 'the current file'
      } before starting a new session.`,
      key: `session:start:${taskId}:${provider}:${sessions.length}`,
      run: () => {
        setActiveCenterTab(TERMINAL_TAB_ID);
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
        sessions.find(
          (entry) => entry.id !== sessionId && isActiveSessionStatus(entry.status)
        ) ??
        sessions.find((entry) => entry.id !== sessionId) ??
        null;

      setSelectedSessionId(nextSelectedSession?.id ?? null);
    }

    void deleteSessionMutation.mutateAsync(sessionId).catch((error) => {
      window.alert(
        error instanceof Error ? error.message : `Autocode could not delete this ${displayName} session.`
      );
    });
  }

  function requestCloseFileTab(path: string) {
    if (activeCenterTab !== path) {
      applyCloseFileTab(path);
      return;
    }

    requestCenterTransition({
      body: `Save or discard your changes to ${
        editorRef.current?.getActiveFilePath() ?? 'the current file'
      } before closing this tab.`,
      key: `close:${taskId}:${path}`,
      run: () => {
        applyCloseFileTab(path);
      },
      title: 'Unsaved file edits'
    });
  }

  function applyCloseFileTab(path: string) {
    const tabIndex = fileTabs.findIndex((tab) => tab.path === path);

    if (tabIndex === -1) {
      return;
    }

    const nextTabs = fileTabs.filter((tab) => tab.path !== path);
    setFileTabs(nextTabs);

    if (activeCenterTab === path) {
      const fallbackTab = nextTabs[tabIndex - 1] ?? nextTabs[tabIndex] ?? null;
      setActiveCenterTab(fallbackTab?.path ?? TERMINAL_TAB_ID);
    }
  }

  function updateActiveFileTabMode(nextMode: 'diff' | 'editor') {
    if (!activeFileTab) {
      return;
    }

    setFileTabs((current) =>
      current.map((tab) =>
        tab.path === activeFileTab.path
          ? {
              ...tab,
              mode: nextMode
            }
          : tab
      )
    );
  }

  function requestCenterTransition(input: {
    body: string;
    key: string;
    run: () => void;
    title: string;
  }) {
    if (activeCenterTab === TERMINAL_TAB_ID || !editorRef.current?.hasUnsavedChanges()) {
      input.run();
      return;
    }

    requestFileTransition(input);
  }

  function handleTerminalResize(cols: number, rows: number) {
    if (
      lastReportedTerminalSizeRef.current.cols === cols &&
      lastReportedTerminalSizeRef.current.rows === rows
    ) {
      return;
    }

    lastReportedTerminalSizeRef.current = { cols, rows };
    setTerminalSize({ cols, rows });

    if (selectedSession && isActiveSessionStatus(selectedSession.status)) {
      resizeSessionMutation.mutate({ cols, rows });
    }
  }

  return (
    <>
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 gap-0">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-1.5 border-b border-white/[0.06] bg-[#141414] px-3 py-1.5">
            {sessions.length === 0 ? (
              <CenterTab
                icon={<Terminal className="h-3.5 w-3.5" />}
                isActive={activeCenterTab === TERMINAL_TAB_ID}
                label="Terminal"
                onClick={requestTerminalSelection}
              />
            ) : (
              sessions.map((session) => {
                const providerIndex = getProviderSessionIndex(sessions, session);
                return (
                  <CenterTab
                    closeLabel={`Delete ${getProviderDisplayName(session.provider)} ${providerIndex}`}
                    icon={<SessionProviderIcon provider={session.provider} isActive={isActiveSessionStatus(session.status)} />}
                    isActive={activeCenterTab === TERMINAL_TAB_ID && selectedSessionId === session.id}
                    key={session.id}
                    label={`${getProviderDisplayName(session.provider)} ${providerIndex}`}
                    onClick={() => {
                      requestSessionSelection(session.id);
                    }}
                    onClose={() => {
                      requestDeleteSession(session.id);
                    }}
                  />
                );
              })
            )}
            <div className="relative" ref={newSessionMenuRef}>
              <button
                className={clsx(
                  'flex h-7 items-center gap-0.5 rounded-md px-1.5 transition',
                  startSessionMutation.isPending || activeSession
                    ? 'bg-white/[0.03] text-white/15'
                    : 'bg-white/[0.06] text-white/50 hover:bg-white/[0.10] hover:text-white'
                )}
                disabled={startSessionMutation.isPending || activeSession !== null}
                onClick={() => setIsNewSessionMenuOpen((c) => !c)}
                title={
                  activeSession
                    ? `Terminate the active ${getProviderDisplayName(activeSession.provider)} session before starting another.`
                    : 'New session'
                }
                type="button"
              >
                {startSessionMutation.isPending ? (
                  <Plus className="h-3.5 w-3.5 animate-pulse" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
                <ChevronDown className="h-2.5 w-2.5" />
              </button>
              {isNewSessionMenuOpen ? (
                <div className="absolute left-0 top-full z-50 mt-1 w-44 rounded-lg border border-white/[0.10] bg-[#1c1c1c] py-1 shadow-xl">
                  <NewSessionOption
                    icon={<Terminal className="h-3.5 w-3.5" />}
                    label="Terminal"
                    onClick={() => requestStartSession('terminal')}
                  />
                  <NewSessionOption
                    icon={<CodexSessionGlyph isActive={false} />}
                    label="Codex"
                    onClick={() => requestStartSession('codex')}
                  />
                  <NewSessionOption
                    icon={<Bot className="h-3.5 w-3.5" />}
                    label="Claude Code"
                    onClick={() => requestStartSession('claude-code')}
                  />
                </div>
              ) : null}
            </div>
            {selectedSessionIsActive ? (
              <button
                className="grid h-7 w-7 place-items-center rounded-md bg-rose-500/[0.10] text-rose-300 transition hover:bg-rose-500/[0.18] hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={terminateSessionMutation.isPending}
                onClick={() => {
                  void terminateSessionMutation.mutateAsync();
                }}
                title="Terminate session"
                type="button"
              >
                <Square className="h-3 w-3" />
              </button>
            ) : null}
            {fileTabs.length > 0 ? (
              <div className="mx-1 h-4 w-px bg-white/[0.08]" />
            ) : null}
            {fileTabs.map((tab) => (
              <CenterTab
                closeLabel={`Close ${tab.path}`}
                icon={<FileCode2 className="h-3.5 w-3.5" />}
                isActive={activeCenterTab === tab.path}
                key={tab.path}
                label={basename(tab.path)}
                onClick={() => {
                  if (activeCenterTab === tab.path) {
                    return;
                  }

                  requestCenterTransition({
                    body: `Save or discard your changes to ${
                      editorRef.current?.getActiveFilePath() ?? 'the current file'
                    } before switching tabs.`,
                    key: `tab:${taskId}:${tab.path}`,
                    run: () => {
                      setActiveCenterTab(tab.path);
                    },
                    title: 'Unsaved file edits'
                  });
                }}
                onClose={() => {
                  requestCloseFileTab(tab.path);
                }}
              />
            ))}
          </div>

          <div className="min-h-0 flex-1">
            {activeCenterTab === TERMINAL_TAB_ID ? (
              <WorkspaceTerminalSurface
                emptyStateMode={startSessionMutation.isPending ? 'starting' : 'idle'}
                entries={transcriptQuery.data?.entries ?? []}
                errorMessage={terminalErrorMessage}
                isInteractive={isActiveSessionStatus(selectedSession?.status)}
                onData={(text) => {
                  if (isActiveSessionStatus(selectedSession?.status)) {
                    sendInputMutation.mutate({ text });
                  }
                }}
                onResize={handleTerminalResize}
                sessionId={selectedSession?.id ?? null}
              />
            ) : (
              <WorkspaceEditorSurface
                ref={editorRef}
                activeChange={activeChange}
                activeFilePath={selectedPath}
                mode={activeFileTab?.mode ?? 'editor'}
                onModeChange={updateActiveFileTabMode}
                taskId={taskId}
              />
            )}
          </div>
        </div>

        <aside className="flex min-h-0 w-[300px] shrink-0 flex-col overflow-hidden bg-[#1c1c1c]">
          <div className="flex items-center gap-1 border-b border-white/[0.06] bg-[#141414] px-3 py-1.5">
            <SidebarTab
              icon={<Files className="h-3.5 w-3.5" />}
              isActive={activeSidebarTab === 'files'}
              label="Files"
              onClick={() => setActiveSidebarTab('files')}
            />
            <SidebarTab
              icon={<GitCompare className="h-3.5 w-3.5" />}
              isActive={activeSidebarTab === 'changes'}
              label="Changes"
              onClick={() => {
                setActiveSidebarTab('changes');
              }}
            />
            <div className="ml-auto flex items-center gap-1">
              <button
                className="grid h-7 w-7 place-items-center rounded-md text-white/40 transition hover:bg-white/[0.08] hover:text-white/70"
                onClick={() => { void handleRefresh(); }}
                title="Refresh"
                type="button"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden">
            {activeSidebarTab === 'files' ? (
              <WorkspaceFileExplorer
                expandedDirectories={expandedDirectories}
                onToggleDirectory={toggleDirectory}
                onSelectPath={(path) => {
                  requestFileSelection(path, 'files', 'editor');
                }}
                selectedPath={selectedPath}
                taskId={taskId}
              />
            ) : (
              <WorkspaceChangesPanel
                changes={changes}
                commitErrorMessage={formatError(commitMutation.error)}
                commitMessage={commitMessage}
                commitNotice={commitNotice}
                commits={commits}
                isCommitting={commitMutation.isPending}
                isLoading={changesQuery.isLoading}
                loadErrorMessage={formatError(changesQuery.error)}
                onCommit={handleCommit}
                onCommitMessageChange={setCommitMessage}
                onRefresh={handleRefresh}
                onSelectChange={(path) => {
                  requestFileSelection(path, 'changes', 'diff');
                  setActiveSidebarTab('changes');
                }}
                selectedPath={selectedPath}
              />
            )}
          </div>
        </aside>
      </div>
    </section>
      <UnsavedChangesDialog
        {...fileSwitchDialogProps}
      />
    </>
  );
});

function SidebarTab({
  icon,
  isActive,
  label,
  onClick
}: {
  icon: React.ReactNode;
  isActive: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={clsx(
        'flex items-center gap-1.5 rounded-md px-2.5 py-1 font-geist text-[12px] font-medium transition',
        isActive
          ? 'bg-white/[0.10] text-white'
          : 'text-white/50 hover:bg-white/[0.06] hover:text-white/80'
      )}
      onClick={onClick}
      type="button"
    >
      {icon}
      {label}
    </button>
  );
}

function formatError(error: unknown): string | null {
  return error instanceof Error ? error.message : null;
}

function basename(value: string): string {
  const parts = value.split('/');
  return parts.at(-1) ?? value;
}

function CenterTab({
  closeLabel,
  icon,
  isActive,
  label,
  onClick,
  onClose
}: {
  closeLabel?: string;
  icon: React.ReactNode;
  isActive: boolean;
  label: string;
  onClick: () => void;
  onClose?: () => void;
}) {
  return (
    <div
      className={clsx(
        'group flex min-w-0 items-center gap-1 rounded-md px-2 py-1 transition',
        isActive
          ? 'bg-white/[0.10] text-white'
          : 'text-white/40 hover:bg-white/[0.06] hover:text-white/70'
      )}
    >
      <button
        className="flex min-w-0 items-center gap-1.5"
        onClick={onClick}
        type="button"
      >
        <span className="shrink-0">{icon}</span>
        <span className="max-w-[140px] truncate font-geist text-[12px] font-medium">{label}</span>
      </button>
      {onClose ? (
        <button
          aria-label={closeLabel ?? `Close ${label}`}
          className={clsx(
            'ml-0.5 rounded-sm p-0.5 transition',
            isActive
              ? 'text-white/40 hover:bg-white/[0.10] hover:text-white/70'
              : 'text-white/20 hover:bg-white/[0.06] hover:text-white/50'
          )}
          onClick={(event) => {
            event.stopPropagation();
            onClose();
          }}
          type="button"
        >
          <X className="h-3 w-3" />
        </button>
      ) : null}
    </div>
  );
}

function CodexSessionGlyph({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={clsx(
        'inline-flex h-2.5 w-2.5 rounded-full transition',
        isActive
          ? 'bg-white shadow-[0_0_6px_rgba(255,255,255,0.25)]'
          : 'bg-white/20'
      )}
    />
  );
}

function SessionProviderIcon({ provider, isActive }: { provider: AgentProvider; isActive: boolean }) {
  switch (provider) {
    case 'codex':
      return <CodexSessionGlyph isActive={isActive} />;
    case 'claude-code':
      return <Bot className={clsx('h-3.5 w-3.5', isActive ? 'text-amber-300' : '')} />;
    case 'terminal':
      return <Terminal className={clsx('h-3.5 w-3.5', isActive ? 'text-emerald-300' : '')} />;
  }
}

function NewSessionOption({
  icon,
  label,
  onClick
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className="flex w-full items-center gap-2 px-3 py-1.5 font-geist text-[12px] text-white/70 transition hover:bg-white/[0.06] hover:text-white"
      onClick={onClick}
      type="button"
    >
      <span className="shrink-0">{icon}</span>
      {label}
    </button>
  );
}

function getProviderDisplayName(provider: AgentProvider): string {
  switch (provider) {
    case 'codex': return 'Codex';
    case 'claude-code': return 'Claude';
    case 'terminal': return 'Terminal';
  }
}

function getProviderSessionIndex(
  sessions: Array<{ id: number; provider: AgentProvider }>,
  session: { id: number; provider: AgentProvider }
): number {
  const sameSessions = sessions.filter((s) => s.provider === session.provider);
  const reverseIndex = [...sameSessions].reverse().findIndex((s) => s.id === session.id);
  return reverseIndex + 1;
}

function isActiveSessionStatus(
  status: AgentSessionStatus | undefined
): status is 'starting' | 'running' {
  return status === 'starting' || status === 'running';
}

async function refreshWorkspaceInspectionQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  taskId: number
) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.workspaceChanges(taskId) }),
    queryClient.invalidateQueries({ queryKey: ['workspace', taskId, 'directory'] }),
    queryClient.invalidateQueries({ queryKey: ['workspace', taskId, 'diff'] })
  ]);
}
