import type { AgentProvider, AgentSessionStatus } from '@shared/domain/agent-session';

export interface WorkspaceFileTab {
  mode: 'diff' | 'editor';
  path: string;
  selectionMode: 'changes' | 'files';
}

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
  const parts = value.split('/');
  return parts.at(-1) ?? value;
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

export function isActiveSessionStatus(
  status: AgentSessionStatus | undefined
): status is 'starting' | 'running' {
  return status === 'starting' || status === 'running';
}
