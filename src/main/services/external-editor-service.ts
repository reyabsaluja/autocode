import { spawn as spawnChildProcess } from 'node:child_process';

import type { WorkspaceOpenInEditorInput } from '../../shared/contracts/workspaces';

type ExternalEditor = WorkspaceOpenInEditorInput['editor'];
type CliEditor = Exclude<ExternalEditor, 'finder'>;

interface DetachedChildProcess {
  once(event: 'error', listener: (error: Error) => void): this;
  once(event: 'spawn', listener: () => void): this;
  unref(): void;
}

type SpawnDetachedProcess = (
  command: string,
  args: string[],
  options: {
    detached: true;
    stdio: 'ignore';
  }
) => DetachedChildProcess;

interface ExternalEditorServiceDependencies {
  openPath: (path: string) => Promise<string>;
  spawn?: SpawnDetachedProcess;
}

const CLI_EDITORS: Record<CliEditor, { command: string; label: string }> = {
  cursor: {
    command: 'cursor',
    label: 'Cursor'
  },
  vscode: {
    command: 'code',
    label: 'VS Code'
  }
};

export function createExternalEditorService({
  openPath,
  spawn = spawnChildProcess as SpawnDetachedProcess
}: ExternalEditorServiceDependencies) {
  return {
    async openInEditor(input: WorkspaceOpenInEditorInput): Promise<void> {
      if (input.editor === 'finder') {
        const errorMessage = await openPath(input.worktreePath);

        if (errorMessage) {
          throw new Error(errorMessage);
        }

        return;
      }

      await spawnDetachedEditor(input.editor, input.worktreePath, spawn);
    }
  };
}

function spawnDetachedEditor(
  editor: CliEditor,
  worktreePath: string,
  spawn: SpawnDetachedProcess
): Promise<void> {
  const editorConfig = CLI_EDITORS[editor];

  return new Promise((resolve, reject) => {
    let child: DetachedChildProcess;
    let settled = false;

    function settle(result: 'resolve' | 'reject', error?: unknown) {
      if (settled) {
        return;
      }

      settled = true;

      if (result === 'resolve') {
        resolve();
        return;
      }

      reject(normalizeExternalEditorSpawnError(editorConfig, error));
    }

    try {
      child = spawn(editorConfig.command, [worktreePath], {
        detached: true,
        stdio: 'ignore'
      });
    } catch (error) {
      settle('reject', error);
      return;
    }

    child.once('error', (error) => {
      settle('reject', error);
    });
    child.once('spawn', () => {
      child.unref();
      settle('resolve');
    });
  });
}

function normalizeExternalEditorSpawnError(
  editor: { command: string; label: string },
  error: unknown
): Error {
  const message = error instanceof Error ? error.message : String(error);
  const code = getErrorCode(error);

  if (code === 'ENOENT') {
    return new Error(`${editor.label} is not installed or is not available on PATH.`);
  }

  if (code === 'EACCES') {
    return new Error(`${editor.label} is installed but Autocode could not execute ${editor.command}.`);
  }

  return new Error(message || `Autocode could not open this workspace in ${editor.label}.`);
}

function getErrorCode(error: unknown): string | number | null {
  if (!error || typeof error !== 'object' || !('code' in error)) {
    return null;
  }

  const code = (error as { code?: string | number }).code;
  return code ?? null;
}
