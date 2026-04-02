import { useQueryClient } from '@tanstack/react-query';

import type { AgentProvider, AgentSessionStatus } from '@shared/domain/agent-session';

import { queryKeys } from '../../lib/query-keys';

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
export const ACTIVE_WORKSPACE_REFRESH_INTERVAL_MS = 2_000;
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

export function getProviderSessionIndex(
  sessions: Array<{ id: number; provider: AgentProvider }>,
  session: { id: number; provider: AgentProvider }
): number {
  const sameSessions = sessions.filter((entry) => entry.provider === session.provider);
  const reverseIndex = [...sameSessions].reverse().findIndex((entry) => entry.id === session.id);
  return reverseIndex + 1;
}

export function isActiveSessionStatus(
  status: AgentSessionStatus | undefined
): status is 'starting' | 'running' {
  return status === 'starting' || status === 'running';
}

export async function refreshWorkspaceInspectionQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  taskId: number
) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.workspaceChanges(taskId) }),
    queryClient.invalidateQueries({ queryKey: ['workspace', taskId, 'directory'] }),
    queryClient.invalidateQueries({ queryKey: ['workspace', taskId, 'diff'] })
  ]);
}
