/**
 * External editor icons (Open button + dropdown): add SVG files under
 * `src/renderer/public/editor-icons/` with the filenames listed below.
 *
 * Vite serves that folder at the site root, so `/editor-icons/...` resolves in dev and build.
 */

export type ExternalEditor = 'cursor' | 'finder' | 'vscode';

export const EXTERNAL_EDITOR_ICON_SRC: Record<ExternalEditor, string> = {
  cursor: '/editor-icons/cursor.svg',
  finder: '/editor-icons/finder.svg',
  vscode: '/editor-icons/vscode.svg'
} as const;

export const EXTERNAL_EDITOR_LABELS: Record<ExternalEditor, string> = {
  cursor: 'Cursor',
  finder: 'Finder',
  vscode: 'VS Code'
} as const;

export const EXTERNAL_EDITORS: ExternalEditor[] = ['finder', 'vscode', 'cursor'];
