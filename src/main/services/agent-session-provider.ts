import { constants as fsConstants } from 'node:fs';
import { access, realpath } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import type { AgentProvider } from '../../shared/domain/agent-session';

const CODEX_COMMAND = 'codex';
const CLAUDE_CODE_COMMAND = 'claude';

const PROVIDER_DISPLAY_NAMES: Record<AgentProvider, string> = {
  'claude-bedrock': 'Claude (Bedrock)',
  'claude-code': 'Claude Code',
  'codex': 'Codex',
  'terminal': 'Terminal'
};

const CLI_SEARCH_PATH_FALLBACKS = [
  path.join(os.homedir(), '.bun', 'bin'),
  path.join(os.homedir(), '.local', 'bin'),
  path.join(os.homedir(), '.npm-global', 'bin'),
  '/opt/homebrew/bin',
  '/usr/local/bin',
  '/usr/bin',
  '/bin'
];

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

export function mergeCustomEnvVars(
  baseEnv: Record<string, string>,
  customEnvVars: string
): Record<string, string> {
  const env = { ...baseEnv };

  for (const line of customEnvVars.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    if (trimmed.startsWith('unset ')) {
      delete env[trimmed.slice(6).trim()];
      continue;
    }

    const withoutExport = trimmed.startsWith('export ') ? trimmed.slice(7) : trimmed;
    const eqIdx = withoutExport.indexOf('=');
    if (eqIdx > 0) {
      env[withoutExport.slice(0, eqIdx)] = withoutExport.slice(eqIdx + 1);
    }
  }

  return env;
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
    case 'claude-bedrock':
      return 'chat:claude-bedrock';
    case 'terminal':
      return process.env.SHELL ?? '/bin/zsh';
  }
}

async function resolveExecutableForProvider(provider: AgentProvider): Promise<string> {
  const cached = resolvedExecutablePaths.get(provider);

  if (cached) {
    return cached;
  }

  const pendingResolution = resolveExecutableForProviderUncached(provider).catch((error) => {
    resolvedExecutablePaths.delete(provider);
    throw error;
  });

  resolvedExecutablePaths.set(provider, pendingResolution);
  return pendingResolution;
}

let cachedAgentProcessEnv: Record<string, string> | null = null;
const resolvedExecutablePaths = new Map<AgentProvider, Promise<string>>();

async function resolveExecutableForProviderUncached(provider: AgentProvider): Promise<string> {
  switch (provider) {
    case 'codex':
      return resolveCliExecutablePath(CODEX_COMMAND, 'Codex CLI');
    case 'claude-code':
      return resolveCliExecutablePath(CLAUDE_CODE_COMMAND, 'Claude Code CLI');
    case 'claude-bedrock':
      return 'chat:claude-bedrock';
    case 'terminal':
      return resolveShellExecutablePath();
  }
}

function buildAgentProcessEnv(): Record<string, string> {
  if (cachedAgentProcessEnv) {
    return cachedAgentProcessEnv;
  }

  const env: Record<string, string> = {};

  for (const key in process.env) {
    const value = process.env[key];

    if (typeof value === 'string') {
      env[key] = value;
    }
  }

  const pathEntries = getCliSearchPaths(process.env.PATH);

  env.PATH = pathEntries.join(path.delimiter);
  cachedAgentProcessEnv = env;
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
  const directoryPaths = getCliSearchPaths(currentPath);
  const candidates: string[] = [];

  for (let directoryIndex = 0; directoryIndex < directoryPaths.length; directoryIndex += 1) {
    const directoryPath = directoryPaths[directoryIndex]!;

    for (let fileIndex = 0; fileIndex < fileNames.length; fileIndex += 1) {
      candidates.push(path.join(directoryPath, fileNames[fileIndex]!));
    }
  }

  return candidates;
}

function getCliSearchPaths(currentPath: string | undefined): string[] {
  const nextEntries: string[] = [];
  const seenEntries = new Set<string>();
  const rawEntries = (currentPath ?? '').split(path.delimiter);

  for (let index = 0; index < rawEntries.length; index += 1) {
    const entry = rawEntries[index]!.trim();

    if (!entry || seenEntries.has(entry)) {
      continue;
    }

    seenEntries.add(entry);
    nextEntries.push(entry);
  }

  for (let index = 0; index < CLI_SEARCH_PATH_FALLBACKS.length; index += 1) {
    const entry = CLI_SEARCH_PATH_FALLBACKS[index]!;

    if (seenEntries.has(entry)) {
      continue;
    }

    seenEntries.add(entry);
    nextEntries.push(entry);
  }

  return nextEntries;
}

function getWindowsExecutableNames(command: string): string[] {
  const executableNames = [command];
  const rawExtensions = (process.env.PATHEXT ?? '.EXE;.CMD;.BAT;.COM').split(';');

  for (let index = 0; index < rawExtensions.length; index += 1) {
    const extension = rawExtensions[index]!.trim();

    if (!extension) {
      continue;
    }

    executableNames.push(`${command}${extension.toLowerCase()}`);
  }

  return executableNames;
}

async function isExecutableFile(candidatePath: string): Promise<boolean> {
  try {
    await access(candidatePath, fsConstants.X_OK);
    return true;
  } catch {
    return false;
  }
}
