import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import {
  ArrowDown,
  ArrowUp,
  Bot,
  Eye,
  EyeOff,
  FileCode2,
  Plus,
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

function formatPresetLabel(name: string): string {
  const t = name.trim();
  if (!t) return t;
  return t.toLowerCase();
}
import { ClaudePresetIcon, CodexPresetIcon } from '../../lib/provider-preset-icons';
import { useProviderPreferencesStore } from '../../stores/provider-preferences-store';
import { useSessionLabelStore } from '../../stores/session-label-store';

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
  const sessionLabels = useSessionLabelStore((state) => state.labels);
  const visibleProviders = useMemo(
    () => providers.filter((entry) => entry.visible),
    [providers]
  );
  const [isNewTabMenuOpen, setIsNewTabMenuOpen] = useState(false);

  const handleNewTabSelect = useCallback((provider: AgentProvider) => {
    setIsNewTabMenuOpen(false);
    onRequestStartSession(provider);
  }, [onRequestStartSession]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === 't') {
        event.preventDefault();
        setIsNewTabMenuOpen((open) => !open);
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="shrink-0 bg-[#141414]">
      <div className="flex h-[42px] items-stretch gap-0 border-b border-white/[0.06]">
        {sessions.map((session) => {
          const providerIndex = getProviderSessionIndex(sessions, session);
          const fallbackLabel = `${getProviderDisplayName(session.provider)} ${providerIndex}`;
          const dynamicLabel = sessionLabels[session.id];
          return (
            <CenterTab
              closeLabel={`Delete ${fallbackLabel}`}
              icon={(
                <SessionProviderIcon
                  provider={session.provider}
                  isActive={isActiveSessionStatus(session.status)}
                />
              )}
              isActive={activeCenterTab === TERMINAL_TAB_ID && selectedSessionId === session.id}
              key={session.id}
              label={dynamicLabel ?? fallbackLabel}
              onClick={() => {
                onRequestSessionSelection(session.id);
              }}
              onClose={() => {
                onDeleteSession(session.id);
              }}
            />
          );
        })}

        {fileTabs.length > 0 ? (
          <div className="flex items-center gap-0">
            {sessions.length > 0 ? <div className="mx-1.5 h-4 w-px bg-white/[0.08]" /> : null}
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

        <NewTabButton
          disabled={startSessionPending}
          isOpen={isNewTabMenuOpen}
          onClose={() => setIsNewTabMenuOpen(false)}
          onSelect={handleNewTabSelect}
          onToggle={() => setIsNewTabMenuOpen((open) => !open)}
          visibleProviders={visibleProviders}
        />
      </div>

      <div className="flex h-[32px] items-center gap-0.5 border-b border-white/[0.06] px-2">
        <ProviderSettingsButton />

        {visibleProviders.map((entry) => (
          <QuickLaunchButton
            key={entry.id}
            disabled={startSessionPending}
            provider={entry.id}
            onClick={() => onRequestStartSession(entry.id)}
          />
        ))}
      </div>
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
        'flex h-6 shrink-0 items-center gap-1.5 whitespace-nowrap rounded px-2 font-geist text-[11px] font-medium leading-none transition',
        disabled
          ? 'cursor-not-allowed text-white/25'
          : 'text-white hover:bg-white/[0.08]'
      )}
      disabled={disabled}
      onClick={onClick}
      title={`New ${formatPresetLabel(getProviderDisplayName(provider))} session`}
      type="button"
    >
      {provider !== 'terminal' ? (
        <PresetMark className="h-3.5 w-3.5 shrink-0" provider={provider} />
      ) : null}
      {formatPresetLabel(getProviderDisplayName(provider))}
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
    <div className="relative flex h-6 shrink-0 items-center" ref={popoverRef}>
      <button
        className={clsx(
          'grid h-6 w-6 shrink-0 place-items-center rounded transition',
          isOpen
            ? 'bg-white/[0.10] text-white'
            : 'text-white hover:bg-white/[0.08]'
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
    <div className="absolute left-0 top-full z-50 mt-1.5 w-52 rounded-lg border border-white/[0.10] bg-[#1c1c1c] shadow-xl">
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

function NewTabButton({
  disabled,
  isOpen,
  onClose,
  onSelect,
  onToggle,
  visibleProviders
}: {
  disabled: boolean;
  isOpen: boolean;
  onClose: () => void;
  onSelect: (provider: AgentProvider) => void;
  onToggle: () => void;
  visibleProviders: Array<{ id: AgentProvider; visible: boolean }>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  return (
    <div className="relative flex items-center px-[9px]" ref={containerRef}>
      <button
        className={clsx(
          'grid h-6 w-6 place-items-center rounded transition',
          isOpen
            ? 'bg-white/[0.10] text-white/60'
            : 'text-white/25 hover:bg-white/[0.06] hover:text-white/50'
        )}
        disabled={disabled}
        onClick={onToggle}
        title="New tab (⌘T)"
        type="button"
      >
        <Plus className="h-3.5 w-3.5 rounded-sm" />
      </button>
      {isOpen ? (
        <div className="absolute left-0 top-full z-50 mt-1 w-44 overflow-hidden rounded-lg border border-white/[0.10] bg-[#1c1c1c] shadow-2xl">
          <div className="py-1">
            {visibleProviders.map((entry) => (
              <button
                key={entry.id}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left transition hover:bg-white/[0.06]"
                onClick={() => onSelect(entry.id)}
                type="button"
              >
                {entry.id !== 'terminal' ? (
                  <PresetMark className="h-3.5 w-3.5 shrink-0" provider={entry.id} />
                ) : null}
                <span className="font-geist text-[12px] font-medium text-white/70">
                  {formatPresetLabel(getProviderDisplayName(entry.id))}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PresetMark({ className, provider }: { className?: string; provider: AgentProvider }) {
  switch (provider) {
    case 'claude-code':
      return <ClaudePresetIcon className={className} />;
    case 'codex':
      return <CodexPresetIcon className={className} />;
    case 'terminal':
      return null;
  }
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

function SessionProviderIcon({ provider }: { provider: AgentProvider; isActive: boolean }) {
  switch (provider) {
    case 'codex':
      return <CodexPresetIcon className="h-3.5 w-3.5" />;
    case 'claude-code':
      return <ClaudePresetIcon className="h-3.5 w-3.5" />;
    case 'terminal':
      return null;
  }
}
