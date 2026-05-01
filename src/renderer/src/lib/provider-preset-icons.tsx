import { type ComponentType, useState } from 'react';
import clsx from 'clsx';

import { PROVIDER_PRESET_ICON_SRC } from './provider-preset-assets';

function PresetIconFromAsset({
  className,
  Fallback,
  imgClassName,
  src
}: {
  className?: string;
  imgClassName?: string;
  Fallback: ComponentType<{ className?: string }>;
  src: string;
}) {
  const [useFallback, setUseFallback] = useState(false);

  if (useFallback) {
    return <Fallback className={className} />;
  }

  return (
    <img
      alt=""
      className={clsx(
        className,
        imgClassName,
        'pointer-events-none select-none object-contain'
      )}
      decoding="async"
      draggable={false}
      onError={() => setUseFallback(true)}
      src={src}
    />
  );
}

function ClaudePresetIconFallback({ className }: { className?: string }) {
  return (
    <svg aria-hidden className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 3.15 13.35 7.5h4.65l-3.76 2.74 1.44 4.4L12 13.45 8.32 14.64l1.44-4.4L6 7.5h4.65L12 3.15z" />
    </svg>
  );
}

function CodexPresetIconFallback({ className }: { className?: string }) {
  return (
    <svg aria-hidden className={className} fill="none" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="7.25" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="2.5" fill="currentColor" />
    </svg>
  );
}

export function ClaudePresetIcon({ className }: { className?: string }) {
  return (
    <PresetIconFromAsset
      className={className}
      Fallback={ClaudePresetIconFallback}
      src={PROVIDER_PRESET_ICON_SRC.claude}
    />
  );
}

/** Asset path: black/dark logos are forced white via filter (fallback SVG uses `currentColor` only). */
export function CodexPresetIcon({ className }: { className?: string }) {
  return (
    <PresetIconFromAsset
      className={className}
      Fallback={CodexPresetIconFallback}
      imgClassName="brightness-0 invert"
      src={PROVIDER_PRESET_ICON_SRC.codex}
    />
  );
}
