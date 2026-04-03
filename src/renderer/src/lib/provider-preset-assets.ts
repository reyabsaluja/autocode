/**
 * Preset-row icons (bottom bar + ⌘T menu): add image files under
 * `src/renderer/public/provider-icons/` (see filenames below).
 *
 * Vite serves that folder at the site root, so `/provider-icons/...` resolves in dev and build.
 *
 * Change the extension here if you use `.png` / `.webp` instead of `.svg`.
 */
export const PROVIDER_PRESET_ICON_SRC = {
  claude: '/provider-icons/claude.svg',
  codex: '/provider-icons/codex.svg'
} as const;
