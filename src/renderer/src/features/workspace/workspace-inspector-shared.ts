import type { AgentProvider, AgentSessionStatus, AgentSessionSurface } from '@shared/domain/agent-session';

export interface WorkspaceFileTab {
  mode: 'diff' | 'editor';
  path: string;
  selectionMode: 'changes' | 'files';
}

export interface NewTabOption {
  id: string;
  kind: 'terminal' | 'chat';
  label: string;
  provider: AgentProvider;
  surface: AgentSessionSurface;
}

export const NEW_TAB_CHAT_OPTION: NewTabOption = {
  id: 'chat:codex',
  kind: 'chat',
  label: 'chat',
  provider: 'codex',
  surface: 'chat'
};

export interface WorkspaceCenterTransitionRequest {
  body: string;
  key: string;
  run: () => void;
  title: string;
}

export const TERMINAL_TAB_ID = '__terminal__';
export const DEFAULT_TERMINAL_SIZE = {
  cols: 120,
  rows: 30
};

export function formatWorkspaceInspectorError(error: unknown): string | null {
  return error instanceof Error ? error.message : null;
}

export function basename(value: string): string {
  const lastSlashIndex = value.lastIndexOf('/');
  return lastSlashIndex === -1 ? value : value.slice(lastSlashIndex + 1);
}

export function getProviderDisplayName(provider: AgentProvider): string {
  switch (provider) {
    case 'codex':
      return 'Codex';
    case 'claude-code':
      return 'Claude';
    case 'terminal':
      return 'Terminal';
  }
}

export function getSessionTabDisplayName(
  provider: AgentProvider,
  surface: AgentSessionSurface
): string {
  if (surface === 'chat') {
    return 'Chat';
  }

  return getProviderDisplayName(provider);
}

export function isActiveSessionStatus(
  status: AgentSessionStatus | undefined
): status is 'starting' | 'running' {
  return status === 'starting' || status === 'running';
}
