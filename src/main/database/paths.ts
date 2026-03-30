import os from 'node:os';
import path from 'node:path';

export const AUTOCODE_APP_NAME = 'Autocode';
export const AUTOCODE_DB_FILENAME = 'autocode.sqlite';

export function resolveAutocodeDatabasePath(): string {
  const overridePath = process.env.AUTOCODE_DB_PATH;

  if (overridePath) {
    return path.resolve(overridePath);
  }

  return path.join(resolveAutocodeUserDataPath(), 'data', AUTOCODE_DB_FILENAME);
}

export function resolveAutocodeWorktreesRoot(): string {
  return path.join(resolveAutocodeUserDataPath(), 'worktrees');
}

function resolveAutocodeUserDataPath(): string {
  const overrideDir = process.env.AUTOCODE_DATA_DIR;

  if (overrideDir) {
    return path.resolve(overrideDir);
  }

  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', AUTOCODE_APP_NAME);
  }

  if (process.platform === 'win32') {
    return path.join(
      process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming'),
      AUTOCODE_APP_NAME
    );
  }

  return path.join(
    process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), '.config'),
    AUTOCODE_APP_NAME.toLowerCase()
  );
}
