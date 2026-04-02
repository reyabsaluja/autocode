import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

// Dedicated socket isolates Autocode sessions from user tmux sessions
// and ensures the tmux server inherits the correct process environment.
const TMUX_SOCKET_NAME = 'autocode';

function tmuxArgs(...args: string[]): string[] {
  return ['-L', TMUX_SOCKET_NAME, ...args];
}

export function getTmuxSessionName(sessionId: number): string {
  return `s${sessionId}`;
}

let cachedAvailability: boolean | null = null;

export async function checkTmuxAvailability(): Promise<boolean> {
  if (cachedAvailability !== null) {
    return cachedAvailability;
  }

  try {
    await execFileAsync('tmux', ['-V']);
    cachedAvailability = true;
  } catch {
    cachedAvailability = false;
  }

  return cachedAvailability;
}

export async function createTmuxSession(input: {
  cols: number;
  cwd: string;
  env: Record<string, string>;
  executablePath: string;
  rows: number;
  sessionName: string;
}): Promise<void> {
  await execFileAsync(
    'tmux',
    tmuxArgs(
      'new-session', '-d',
      '-s', input.sessionName,
      '-x', String(input.cols),
      '-y', String(input.rows),
      input.executablePath
    ),
    {
      cwd: input.cwd,
      env: input.env
    }
  );
}

export function getTmuxAttachSpawnArgs(sessionName: string): {
  args: string[];
  command: string;
} {
  return {
    args: tmuxArgs('attach-session', '-t', sessionName),
    command: 'tmux'
  };
}

export async function isTmuxSessionAlive(sessionName: string): Promise<boolean> {
  try {
    await execFileAsync('tmux', tmuxArgs('has-session', '-t', sessionName));
    return true;
  } catch {
    return false;
  }
}

export async function killTmuxSession(sessionName: string): Promise<void> {
  try {
    await execFileAsync('tmux', tmuxArgs('kill-session', '-t', sessionName));
  } catch {
    // Session might already be dead
  }
}

export async function resizeTmuxSession(
  sessionName: string,
  cols: number,
  rows: number
): Promise<void> {
  try {
    await execFileAsync('tmux', tmuxArgs(
      'resize-window', '-t', sessionName,
      '-x', String(cols), '-y', String(rows)
    ));
  } catch {
    // Best effort — resize can fail if session just exited
  }
}
