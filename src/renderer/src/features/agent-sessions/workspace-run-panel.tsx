import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  Play,
  Square,
  Terminal
} from 'lucide-react';

import type { AgentSession, AgentSessionStatus } from '@shared/domain/agent-session';

import {
  useAgentSessionInputMutation,
  useAgentSessionResizeMutation,
  useAgentSessionStream,
  useAgentSessionTranscriptTailQuery,
  useAgentSessionsQuery,
  useStartAgentSessionMutation,
  useTerminateAgentSessionMutation
} from './agent-session-hooks';
import { AgentSessionTerminal } from './agent-session-terminal';

interface WorkspaceRunPanelProps {
  taskId: number;
}

const DEFAULT_TERMINAL_SIZE = {
  cols: 120,
  rows: 30
};

export function WorkspaceRunPanel({ taskId }: WorkspaceRunPanelProps) {
  const sessionsQuery = useAgentSessionsQuery(taskId);
  const sessions = sessionsQuery.data ?? [];
  const activeSession = useMemo(
    () => sessions.find((session) => isActiveSessionStatus(session.status)) ?? null,
    [sessions]
  );
  const [isOpen, setIsOpen] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [terminalSize, setTerminalSize] = useState(DEFAULT_TERMINAL_SIZE);
  const lastReportedTerminalSizeRef = useRef(DEFAULT_TERMINAL_SIZE);
  const previousActiveSessionIdRef = useRef<number | null>(null);
  const startSessionMutation = useStartAgentSessionMutation(taskId);
  const terminateSessionMutation = useTerminateAgentSessionMutation(activeSession?.id ?? null);
  const sendInputMutation = useAgentSessionInputMutation(selectedSessionId);
  const resizeSessionMutation = useAgentSessionResizeMutation(selectedSessionId);
  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === selectedSessionId) ?? null,
    [selectedSessionId, sessions]
  );
  const transcriptQuery = useAgentSessionTranscriptTailQuery(selectedSessionId, selectedSessionId !== null);

  useAgentSessionStream(taskId);

  useEffect(() => {
    setIsOpen(false);
    setSelectedSessionId(null);
    lastReportedTerminalSizeRef.current = DEFAULT_TERMINAL_SIZE;
    previousActiveSessionIdRef.current = null;
  }, [taskId]);

  useEffect(() => {
    if (!sessions.length) {
      setSelectedSessionId(null);
      previousActiveSessionIdRef.current = null;
      return;
    }

    const nextSelectedSession = activeSession ?? sessions[0] ?? null;

    if (
      nextSelectedSession &&
      (selectedSessionId === null ||
        !sessions.some((session) => session.id === selectedSessionId))
    ) {
      setSelectedSessionId(nextSelectedSession.id);
    }

    if (
      activeSession &&
      activeSession.id !== previousActiveSessionIdRef.current
    ) {
      setIsOpen(true);
    }

    previousActiveSessionIdRef.current = activeSession?.id ?? null;
  }, [activeSession, selectedSessionId, sessions]);

  const handleStartSession = async () => {
    const session = await startSessionMutation.mutateAsync({ ...terminalSize, provider: 'codex' });
    setSelectedSessionId(session.id);
    setIsOpen(true);
  };

  const handleResize = (cols: number, rows: number) => {
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
  };

  const selectedTranscriptEntries = transcriptQuery.data?.entries ?? [];
  const isSelectedSessionInteractive = isActiveSessionStatus(selectedSession?.status);
  const statusLabel = selectedSession ? formatSessionStatus(selectedSession.status) : 'No run selected';
  const errorMessage =
    formatError(startSessionMutation.error) ??
    formatError(terminateSessionMutation.error) ??
    formatError(transcriptQuery.error) ??
    formatError(sessionsQuery.error);

  return (
    <section className="border-t border-white/[0.06] bg-[#111111]">
      <button
        className="flex w-full items-center gap-2 px-4 py-2 text-left transition hover:bg-white/[0.03]"
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        <Terminal className="h-4 w-4 text-white/60" />
        <div className="min-w-0 flex-1">
          <p className="font-geist text-[12px] font-semibold uppercase tracking-[0.12em] text-white/60">
            Codex Runs
          </p>
          <p className="truncate font-geist text-[12px] text-white/35">
            {activeSession
              ? `${sessions.length} run${sessions.length === 1 ? '' : 's'} · active now`
              : sessions.length > 0
                ? `${sessions.length} historical run${sessions.length === 1 ? '' : 's'}`
                : 'Start a Codex run inside this task workspace'}
          </p>
        </div>
        {isOpen ? (
          <ChevronDown className="h-4 w-4 text-white/40" />
        ) : (
          <ChevronUp className="h-4 w-4 text-white/40" />
        )}
      </button>

      {isOpen ? (
        <div className="border-t border-white/[0.06]">
          <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.06] px-4 py-3">
            <label className="flex min-w-0 items-center gap-2">
              <span className="font-geist text-[11px] font-semibold uppercase tracking-[0.12em] text-white/45">
                Session
              </span>
              <select
                className="max-w-[260px] rounded-md border border-white/[0.08] bg-white/[0.05] px-2.5 py-1.5 font-geist text-[12px] text-white outline-none transition focus:border-white/20"
                onChange={(event) => {
                  const value = event.target.value;

                  if (!value) {
                    setSelectedSessionId(null);
                    return;
                  }

                  const nextValue = Number(value);
                  setSelectedSessionId(Number.isFinite(nextValue) ? nextValue : null);
                }}
                value={selectedSessionId ?? ''}
              >
                {sessions.length === 0 ? <option value="">No runs yet</option> : null}
                {sessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {formatSessionOptionLabel(session)}
                  </option>
                ))}
              </select>
            </label>

            <SessionStatusBadge status={selectedSession?.status ?? null} />

            <div className="ml-auto flex items-center gap-2">
              {activeSession ? (
                <button
                  className="inline-flex items-center gap-1.5 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 font-geist text-[12px] font-medium text-rose-200 transition hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={terminateSessionMutation.isPending}
                  onClick={() => { void terminateSessionMutation.mutateAsync(); }}
                  type="button"
                >
                  {terminateSessionMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Square className="h-3.5 w-3.5" />
                  )}
                  Terminate
                </button>
              ) : (
                <button
                  className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 font-geist text-[12px] font-medium text-emerald-100 transition hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={startSessionMutation.isPending}
                  onClick={() => { void handleStartSession(); }}
                  type="button"
                >
                  {startSessionMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Play className="h-3.5 w-3.5" />
                  )}
                  Start Codex Run
                </button>
              )}
            </div>
          </div>

          {errorMessage ? (
            <div className="border-b border-rose-500/20 bg-rose-500/[0.06] px-4 py-2 font-geist text-[12px] text-rose-200">
              {errorMessage}
            </div>
          ) : null}

          {selectedSession ? (
            <>
              <div className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-2 font-geist text-[11px] uppercase tracking-[0.12em] text-white/35">
                <span>{statusLabel}</span>
                <span>PID {selectedSession.pid ?? 'n/a'}</span>
                <span>Events {selectedSession.lastEventSeq}</span>
              </div>

              <div className="h-[260px] bg-[#101010]">
                <AgentSessionTerminal
                  entries={selectedTranscriptEntries}
                  isInteractive={isSelectedSessionInteractive}
                  isVisible={isOpen}
                  onData={(text) => {
                    if (isSelectedSessionInteractive) {
                      sendInputMutation.mutate({ text });
                    }
                  }}
                  onResize={handleResize}
                  sessionId={selectedSession.id}
                />
              </div>
            </>
          ) : (
            <div className="grid h-[220px] place-items-center px-4 text-center">
              <div className="max-w-sm">
                <p className="font-geist text-[13px] text-white/55">
                  Codex runs stay attached to this task workspace and can be reopened from here later.
                </p>
                <p className="mt-2 font-geist text-[12px] text-white/35">
                  Start the first run to open an interactive terminal inside this worktree.
                </p>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}

function SessionStatusBadge({ status }: { status: AgentSessionStatus | null }) {
  return (
    <span
      className={clsx(
        'rounded-md border px-2 py-1 font-geist text-[10px] font-bold uppercase tracking-[0.08em]',
        status ? SESSION_STATUS_STYLES[status] : 'border-white/[0.08] bg-white/[0.05] text-white/45'
      )}
    >
      {status ? formatSessionStatus(status) : 'No run'}
    </span>
  );
}

function formatError(error: unknown): string | null {
  return error instanceof Error ? error.message : null;
}

function formatSessionOptionLabel(session: AgentSession): string {
  return `#${session.id} · ${formatSessionStatus(session.status)} · ${formatSessionTime(session.createdAt)}`;
}

function formatSessionStatus(status: AgentSessionStatus): string {
  return status.replace('_', ' ');
}

function formatSessionTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

function isActiveSessionStatus(status: AgentSessionStatus | undefined): status is 'starting' | 'running' {
  return status === 'starting' || status === 'running';
}

const SESSION_STATUS_STYLES: Record<AgentSessionStatus, string> = {
  completed: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
  failed: 'border-rose-500/30 bg-rose-500/10 text-rose-200',
  running: 'border-sky-500/30 bg-sky-500/10 text-sky-200',
  starting: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
  terminated: 'border-zinc-500/30 bg-zinc-500/10 text-zinc-300'
};
