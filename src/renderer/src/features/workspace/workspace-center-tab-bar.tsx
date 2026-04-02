import type { ReactNode, RefObject } from 'react';
import clsx from 'clsx';
import { Bot, ChevronDown, FileCode2, Plus, Square, Terminal, X } from 'lucide-react';

import type { AgentProvider, AgentSession } from '@shared/domain/agent-session';
import type { WorkspaceFileTab } from './workspace-inspector-shared';
import { basename, getProviderDisplayName, getProviderSessionIndex, isActiveSessionStatus, TERMINAL_TAB_ID } from './workspace-inspector-shared';

interface WorkspaceCenterTabBarProps {
  activeCenterTab: string;
  fileTabs: WorkspaceFileTab[];
  isNewSessionMenuOpen: boolean;
  newSessionButtonDisabled: boolean;
  newSessionButtonTitle: string;
  newSessionMenuRef: RefObject<HTMLDivElement | null>;
  onCloseFileTab: (path: string) => void;
  onDeleteSession: (sessionId: number) => void;
  onRequestFileTabActivation: (path: string) => void;
  onRequestSessionSelection: (sessionId: number) => void;
  onRequestStartSession: (provider: AgentProvider) => void;
  onRequestTerminalSelection: () => void;
  onTerminateSession: () => void;
  selectedSessionId: number | null;
  selectedSessionIsActive: boolean;
  sessions: AgentSession[];
  startSessionPending: boolean;
  terminateSessionPending: boolean;
  toggleNewSessionMenu: () => void;
}

export function WorkspaceCenterTabBar({
  activeCenterTab,
  fileTabs,
  isNewSessionMenuOpen,
  newSessionButtonDisabled,
  newSessionButtonTitle,
  newSessionMenuRef,
  onCloseFileTab,
  onDeleteSession,
  onRequestFileTabActivation,
  onRequestSessionSelection,
  onRequestStartSession,
  onRequestTerminalSelection,
  onTerminateSession,
  selectedSessionId,
  selectedSessionIsActive,
  sessions,
  startSessionPending,
  terminateSessionPending,
  toggleNewSessionMenu
}: WorkspaceCenterTabBarProps) {
  return (
    <div className="flex items-center gap-1.5 border-b border-white/[0.06] bg-[#141414] px-3 py-1.5">
      {sessions.length === 0 ? (
        <CenterTab
          icon={<Terminal className="h-3.5 w-3.5" />}
          isActive={activeCenterTab === TERMINAL_TAB_ID}
          label="Terminal"
          onClick={onRequestTerminalSelection}
        />
      ) : (
        sessions.map((session) => {
          const providerIndex = getProviderSessionIndex(sessions, session);
          return (
            <CenterTab
              closeLabel={`Delete ${getProviderDisplayName(session.provider)} ${providerIndex}`}
              icon={(
                <SessionProviderIcon
                  provider={session.provider}
                  isActive={isActiveSessionStatus(session.status)}
                />
              )}
              isActive={activeCenterTab === TERMINAL_TAB_ID && selectedSessionId === session.id}
              key={session.id}
              label={`${getProviderDisplayName(session.provider)} ${providerIndex}`}
              onClick={() => {
                onRequestSessionSelection(session.id);
              }}
              onClose={() => {
                onDeleteSession(session.id);
              }}
            />
          );
        })
      )}
      <div className="relative" ref={newSessionMenuRef}>
        <button
          className={clsx(
            'flex h-7 items-center gap-0.5 rounded-md px-1.5 transition',
            newSessionButtonDisabled
              ? 'bg-white/[0.03] text-white/15'
              : 'bg-white/[0.06] text-white/50 hover:bg-white/[0.10] hover:text-white'
          )}
          disabled={newSessionButtonDisabled}
          onClick={toggleNewSessionMenu}
          title={newSessionButtonTitle}
          type="button"
        >
          {startSessionPending ? (
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
              onClick={() => onRequestStartSession('terminal')}
            />
            <NewSessionOption
              icon={<CodexSessionGlyph isActive={false} />}
              label="Codex"
              onClick={() => onRequestStartSession('codex')}
            />
            <NewSessionOption
              icon={<Bot className="h-3.5 w-3.5" />}
              label="Claude Code"
              onClick={() => onRequestStartSession('claude-code')}
            />
          </div>
        ) : null}
      </div>
      {selectedSessionIsActive ? (
        <button
          className="grid h-7 w-7 place-items-center rounded-md bg-rose-500/[0.10] text-rose-300 transition hover:bg-rose-500/[0.18] hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={terminateSessionPending}
          onClick={onTerminateSession}
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
            onRequestFileTabActivation(tab.path);
          }}
          onClose={() => {
            onCloseFileTab(tab.path);
          }}
        />
      ))}
    </div>
  );
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
  icon: ReactNode;
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
  icon: ReactNode;
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
