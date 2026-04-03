import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import {
  ArrowDown,
  ArrowUp,
  Bot,
  Eye,
  EyeOff,
  FileCode2,
  RotateCcw,
  Settings,
  Terminal,
  X
} from 'lucide-react';

import type { AgentProvider, AgentSession } from '@shared/domain/agent-session';
import type { WorkspaceFileTab } from './workspace-inspector-shared';
import {
  basename,
  getProviderDisplayName,
  getProviderSessionIndex,
  isActiveSessionStatus,
  TERMINAL_TAB_ID
} from './workspace-inspector-shared';
import { useProviderPreferencesStore } from '../../stores/provider-preferences-store';

interface WorkspaceCenterTabBarProps {
  activeCenterTab: string;
  fileTabs: WorkspaceFileTab[];
  onCloseFileTab: (path: string) => void;
  onDeleteSession: (sessionId: number) => void;
  onRequestFileTabActivation: (path: string) => void;
  onRequestSessionSelection: (sessionId: number) => void;
  onRequestStartSession: (provider: AgentProvider) => void;
  selectedSessionId: number | null;
  sessions: AgentSession[];
  startSessionPending: boolean;
}

export function WorkspaceCenterTabBar({
  activeCenterTab,
  fileTabs,
  onCloseFileTab,
  onDeleteSession,
  onRequestFileTabActivation,
  onRequestSessionSelection,
  onRequestStartSession,
  selectedSessionId,
  sessions,
  startSessionPending
}: WorkspaceCenterTabBarProps) {
  const providers = useProviderPreferencesStore((state) => state.providers);
  const visibleProviders = useMemo(
    () => providers.filter((entry) => entry.visible),
    [providers]
  );

  return (
    <div className="flex h-[42px] shrink-0 items-stretch gap-0 border-b border-white/[0.06] bg-[#141414]">
      {sessions.map((session) => {
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
      })}

      <div className="flex items-center gap-1.5 px-3">
        <div className="h-4 w-px bg-white/[0.08]" />

        {visibleProviders.map((entry) => (
          <QuickLaunchButton
            key={entry.id}
            disabled={startSessionPending}
            provider={entry.id}
            onClick={() => onRequestStartSession(entry.id)}
          />
        ))}

        <ProviderSettingsButton />
      </div>

      {fileTabs.length > 0 ? (
        <div className="flex items-center gap-0">
          <div className="mx-1.5 h-4 w-px bg-white/[0.08]" />
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
      ) : null}
    </div>
  );
}

function QuickLaunchButton({
  disabled,
  provider,
  onClick
}: {
  disabled: boolean;
  provider: AgentProvider;
  onClick: () => void;
}) {
  return (
    <button
      className={clsx(
        'flex h-7 min-h-7 max-h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-dashed px-2 font-geist text-[11px] font-medium leading-none transition',
        disabled
          ? 'border-white/[0.06] text-white/15'
          : 'border-white/[0.12] text-white/40 hover:border-white/[0.20] hover:bg-white/[0.06] hover:text-white/70'
      )}
      disabled={disabled}
      onClick={onClick}
      title={`New ${getProviderDisplayName(provider)} session`}
      type="button"
    >
      <ProviderIcon provider={provider} />
      {getProviderDisplayName(provider)}
    </button>
  );
}

function ProviderSettingsButton() {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div className="relative" ref={popoverRef}>
      <button
        className={clsx(
          'grid h-7 w-7 place-items-center rounded-md transition',
          isOpen
            ? 'bg-white/[0.10] text-white/60'
            : 'text-white/25 hover:bg-white/[0.06] hover:text-white/50'
        )}
        onClick={() => setIsOpen((current) => !current)}
        title="Provider settings"
        type="button"
      >
        <Settings className="h-3.5 w-3.5" />
      </button>
      {isOpen ? <ProviderSettingsPopover /> : null}
    </div>
  );
}

function ProviderSettingsPopover() {
  const providers = useProviderPreferencesStore((state) => state.providers);
  const toggleProvider = useProviderPreferencesStore((state) => state.toggleProvider);
  const reorderProvider = useProviderPreferencesStore((state) => state.reorderProvider);
  const resetToDefaults = useProviderPreferencesStore((state) => state.resetToDefaults);

  return (
    <div className="absolute right-0 top-full z-50 mt-1.5 w-52 rounded-lg border border-white/[0.10] bg-[#1c1c1c] shadow-xl">
      <div className="flex items-center justify-between border-b border-white/[0.08] px-3 py-2">
        <span className="font-geist text-[11px] font-semibold uppercase tracking-[0.08em] text-white/40">
          Providers
        </span>
        <button
          className="flex items-center gap-1 rounded px-1.5 py-0.5 font-geist text-[10px] text-white/30 transition hover:bg-white/[0.06] hover:text-white/60"
          onClick={() => {
            resetToDefaults();
          }}
          title="Reset to defaults"
          type="button"
        >
          <RotateCcw className="h-2.5 w-2.5" />
          Reset
        </button>
      </div>
      <div className="py-1">
        {providers.map((entry, index) => (
          <div
            key={entry.id}
            className="flex items-center gap-1.5 px-2 py-1"
          >
            <ProviderIcon provider={entry.id} />
            <span className={clsx(
              'flex-1 font-geist text-[12px] font-medium',
              entry.visible ? 'text-white/70' : 'text-white/25'
            )}>
              {getProviderDisplayName(entry.id)}
            </span>
            <button
              className="grid h-5 w-5 place-items-center rounded text-white/25 transition hover:bg-white/[0.08] hover:text-white/60 disabled:opacity-30"
              disabled={index === 0}
              onClick={() => reorderProvider(index, index - 1)}
              title="Move up"
              type="button"
            >
              <ArrowUp className="h-3 w-3" />
            </button>
            <button
              className="grid h-5 w-5 place-items-center rounded text-white/25 transition hover:bg-white/[0.08] hover:text-white/60 disabled:opacity-30"
              disabled={index === providers.length - 1}
              onClick={() => reorderProvider(index, index + 1)}
              title="Move down"
              type="button"
            >
              <ArrowDown className="h-3 w-3" />
            </button>
            <button
              className={clsx(
                'grid h-5 w-5 place-items-center rounded transition hover:bg-white/[0.08]',
                entry.visible
                  ? 'text-white/40 hover:text-white/70'
                  : 'text-white/15 hover:text-white/40'
              )}
              onClick={() => toggleProvider(entry.id)}
              title={entry.visible ? 'Hide' : 'Show'}
              type="button"
            >
              {entry.visible ? (
                <Eye className="h-3 w-3" />
              ) : (
                <EyeOff className="h-3 w-3" />
              )}
            </button>
          </div>
        ))}
      </div>
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
        'group flex min-w-0 items-center gap-1 px-3 transition',
        isActive
          ? 'bg-white/[0.10] text-white'
          : 'text-white/40 hover:bg-white/[0.06] hover:text-white/70'
      )}
    >
      <button
        className={clsx(
          'flex items-center gap-1.5',
          onClose ? 'min-w-0 flex-1 overflow-hidden' : null
        )}
        onClick={onClick}
        type="button"
      >
        <span className="shrink-0">{icon}</span>
        <span className="max-w-[140px] truncate font-geist text-[12px] font-medium leading-tight">{label}</span>
      </button>
      {onClose ? (
        <button
          aria-label={closeLabel ?? `Close ${label}`}
          className={clsx(
            'ml-0.5 rounded-sm p-0.5 opacity-0 transition group-hover:opacity-100',
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

function ProviderIcon({ provider }: { provider: AgentProvider }) {
  switch (provider) {
    case 'codex':
      return <CodexGlyph />;
    case 'claude-code':
      return <Bot className="h-3 w-3" />;
    case 'terminal':
      return <Terminal className="h-3 w-3" />;
  }
}

function CodexGlyph() {
  return (
    <span className="inline-flex h-2.5 w-2.5 rounded-full bg-white/20" />
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
