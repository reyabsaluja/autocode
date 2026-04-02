import { constants as fsConstants } from 'node:fs';
import { access, realpath } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import type { AgentProvider } from '../../shared/domain/agent-session';

const CODEX_COMMAND = 'codex';
const CLAUDE_CODE_COMMAND = 'claude';

const PROVIDER_DISPLAY_NAMES: Record<AgentProvider, string> = {
  'claude-code': 'Claude Code',
  'codex': 'Codex',
  'terminal': 'Terminal'
};

export interface ResolvedAgentProviderRuntime {
  command: string;
  displayName: string;
  env: Record<string, string>;
  executablePath: string;
  provider: AgentProvider;
}

export function getAgentProviderCommand(provider: AgentProvider): string {
  return resolveCommandNameForProvider(provider);
}

export function getAgentProviderDisplayName(provider: AgentProvider): string {
  return PROVIDER_DISPLAY_NAMES[provider] ?? provider;
}

export function createActiveSessionConflictMessage(
  activeProvider: AgentProvider,
  requestedProvider: AgentProvider
): string {
  const activeDisplayName = getAgentProviderDisplayName(activeProvider);
  const requestedDisplayName = getAgentProviderDisplayName(requestedProvider);

  if (activeProvider === requestedProvider) {
    return `This task already has an active ${activeDisplayName} session.`;
  }

  return `This task already has an active ${activeDisplayName} session. Terminate it before starting ${requestedDisplayName}.`;
}

export async function resolveAgentProviderRuntime(
  provider: AgentProvider
): Promise<ResolvedAgentProviderRuntime> {
  return {
    command: getAgentProviderCommand(provider),
    displayName: getAgentProviderDisplayName(provider),
    env: buildAgentProcessEnv(),
    executablePath: await resolveExecutableForProvider(provider),
    provider
  };
}

export function buildInitialInputForProvider(
  provider: AgentProvider,
  title: string,
  description: string | null
): string | null {
  if (provider === 'terminal') {
    return null;
  }

  return buildInitialPrompt(title, description);
}

export function normalizeAgentSpawnError(
  error: unknown,
  provider: AgentProvider
): string {
  const message = error instanceof Error ? error.message : String(error);
  const displayName = getAgentProviderDisplayName(provider);

  if (
    message.includes('ENOENT') ||
    message.includes('not found') ||
    message.includes('posix_spawnp failed')
  ) {
    return `${displayName} is not installed or is not available on PATH.`;
  }

  if (!message) {
    return `Autocode could not start ${displayName}.`;
  }

  return message;
}

function buildInitialPrompt(title: string, description: string | null): string {
  const normalizedTitle = title.trim();
  const normalizedDescription = description?.trim() ?? '';

  if (!normalizedTitle) {
    return '';
  }

  if (!normalizedDescription) {
    return `${normalizedTitle}\n`;
  }

  return `${normalizedTitle}\n\n${normalizedDescription}\n`;
}

function resolveCommandNameForProvider(provider: AgentProvider): string {
  switch (provider) {
    case 'codex':
      return CODEX_COMMAND;
    case 'claude-code':
      return CLAUDE_CODE_COMMAND;
    case 'terminal':
      return process.env.SHELL ?? '/bin/zsh';
  }
}

async function resolveExecutableForProvider(provider: AgentProvider): Promise<string> {
  switch (provider) {
    case 'codex':
      return resolveCliExecutablePath(CODEX_COMMAND, 'Codex CLI');
    case 'claude-code':
      return resolveCliExecutablePath(CLAUDE_CODE_COMMAND, 'Claude Code CLI');
    case 'terminal':
      return resolveShellExecutablePath();
  }
}

function buildAgentProcessEnv(): Record<string, string> {
  const env = Object.fromEntries(
    Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
  );
  const pathEntries = getCliSearchPaths(process.env.PATH);

  env.PATH = pathEntries.join(path.delimiter);
  return env;
}

async function resolveShellExecutablePath(): Promise<string> {
  const shell = process.env.SHELL;

  if (shell && await isExecutableFile(shell)) {
    return shell;
  }

  for (const fallback of ['/bin/zsh', '/bin/bash', '/bin/sh']) {
    if (await isExecutableFile(fallback)) {
      return fallback;
    }
  }

  throw new Error('Could not find a shell executable on this system.');
}

async function resolveCliExecutablePath(command: string, displayName: string): Promise<string> {
  for (const candidate of getCliExecutableCandidates(command, process.env.PATH)) {
    if (await isExecutableFile(candidate)) {
      return realpath(candidate).catch(() => candidate);
    }
  }

  throw new Error(`${displayName} is not installed or is not available on PATH.`);
}

function getCliExecutableCandidates(command: string, currentPath: string | undefined): string[] {
  const fileNames = process.platform === 'win32'
    ? getWindowsExecutableNames(command)
    : [command];

  return getCliSearchPaths(currentPath).flatMap((directoryPath) =>
    fileNames.map((fileName) => path.join(directoryPath, fileName))
  );
}

function getCliSearchPaths(currentPath: string | undefined): string[] {
  const pathEntries = (currentPath ?? '')
    .split(path.delimiter)
    .map((entry) => entry.trim())
    .filter(Boolean);
  const fallbackEntries = [
    path.join(os.homedir(), '.bun', 'bin'),
    path.join(os.homedir(), '.local', 'bin'),
    path.join(os.homedir(), '.npm-global', 'bin'),
    '/opt/homebrew/bin',
    '/usr/local/bin',
    '/usr/bin',
    '/bin'
  ];

  return [...new Set([...pathEntries, ...fallbackEntries])];
}

function getWindowsExecutableNames(command: string): string[] {
  const pathExtensions = (process.env.PATHEXT ?? '.EXE;.CMD;.BAT;.COM')
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean);

  return [command, ...pathExtensions.map((extension) => `${command}${extension.toLowerCase()}`)];
}

async function isExecutableFile(candidatePath: string): Promise<boolean> {
  try {
    await access(candidatePath, fsConstants.X_OK);
    return true;
  } catch {
    return false;
  }
}
