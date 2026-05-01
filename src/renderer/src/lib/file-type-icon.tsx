import clsx from 'clsx';
import {
  Braces,
  File,
  FileCode2,
  FileText,
  Image,
  Lock,
  Settings,
  Shield,
  type LucideIcon
} from 'lucide-react';

interface FileTypeIconProps {
  filename: string;
  className?: string;
}

type IconDef =
  | { type: 'lucide'; icon: LucideIcon; colorClass: string }
  | { type: 'text'; label: string; colorClass: string };

const filenameIcons: Record<string, IconDef> = {
  '.gitignore': { type: 'lucide', icon: Settings, colorClass: 'text-zinc-500' },
  '.gitattributes': { type: 'lucide', icon: Settings, colorClass: 'text-zinc-500' },
  '.gitmodules': { type: 'lucide', icon: Settings, colorClass: 'text-zinc-500' },
  '.env': { type: 'lucide', icon: Shield, colorClass: 'text-yellow-600' },
  '.env.local': { type: 'lucide', icon: Shield, colorClass: 'text-yellow-600' },
  '.env.development': { type: 'lucide', icon: Shield, colorClass: 'text-yellow-600' },
  '.env.production': { type: 'lucide', icon: Shield, colorClass: 'text-yellow-600' },
  'package.json': { type: 'lucide', icon: Braces, colorClass: 'text-green-500' },
  'tsconfig.json': { type: 'lucide', icon: Braces, colorClass: 'text-blue-400' },
  LICENSE: { type: 'lucide', icon: FileText, colorClass: 'text-yellow-500' },
  Dockerfile: { type: 'lucide', icon: FileCode2, colorClass: 'text-sky-400' },
  Makefile: { type: 'lucide', icon: FileCode2, colorClass: 'text-orange-400' }
};

const extensionIcons: Record<string, IconDef> = {
  ts: { type: 'text', label: 'TS', colorClass: 'text-blue-400' },
  tsx: { type: 'text', label: 'TS', colorClass: 'text-blue-400' },
  js: { type: 'text', label: 'JS', colorClass: 'text-yellow-400' },
  jsx: { type: 'text', label: 'JS', colorClass: 'text-yellow-400' },
  mjs: { type: 'text', label: 'JS', colorClass: 'text-yellow-400' },
  cjs: { type: 'text', label: 'JS', colorClass: 'text-yellow-400' },
  json: { type: 'lucide', icon: Braces, colorClass: 'text-yellow-500' },
  md: { type: 'lucide', icon: FileText, colorClass: 'text-blue-300' },
  mdx: { type: 'lucide', icon: FileText, colorClass: 'text-blue-300' },
  css: { type: 'lucide', icon: FileCode2, colorClass: 'text-purple-400' },
  scss: { type: 'lucide', icon: FileCode2, colorClass: 'text-pink-400' },
  less: { type: 'lucide', icon: FileCode2, colorClass: 'text-purple-400' },
  html: { type: 'lucide', icon: FileCode2, colorClass: 'text-orange-400' },
  py: { type: 'lucide', icon: FileCode2, colorClass: 'text-green-400' },
  rs: { type: 'lucide', icon: FileCode2, colorClass: 'text-orange-300' },
  go: { type: 'lucide', icon: FileCode2, colorClass: 'text-cyan-400' },
  rb: { type: 'lucide', icon: FileCode2, colorClass: 'text-red-400' },
  java: { type: 'lucide', icon: FileCode2, colorClass: 'text-orange-400' },
  toml: { type: 'lucide', icon: Settings, colorClass: 'text-zinc-400' },
  yaml: { type: 'lucide', icon: Settings, colorClass: 'text-zinc-400' },
  yml: { type: 'lucide', icon: Settings, colorClass: 'text-zinc-400' },
  lock: { type: 'lucide', icon: Lock, colorClass: 'text-green-500' },
  svg: { type: 'lucide', icon: Image, colorClass: 'text-purple-400' },
  png: { type: 'lucide', icon: Image, colorClass: 'text-purple-400' },
  jpg: { type: 'lucide', icon: Image, colorClass: 'text-purple-400' },
  jpeg: { type: 'lucide', icon: Image, colorClass: 'text-purple-400' },
  gif: { type: 'lucide', icon: Image, colorClass: 'text-purple-400' },
  webp: { type: 'lucide', icon: Image, colorClass: 'text-purple-400' },
  ico: { type: 'lucide', icon: Image, colorClass: 'text-purple-400' },
  xml: { type: 'lucide', icon: FileCode2, colorClass: 'text-orange-300' },
  sql: { type: 'lucide', icon: FileCode2, colorClass: 'text-cyan-300' },
  sh: { type: 'lucide', icon: FileCode2, colorClass: 'text-green-300' },
  bash: { type: 'lucide', icon: FileCode2, colorClass: 'text-green-300' },
  zsh: { type: 'lucide', icon: FileCode2, colorClass: 'text-green-300' },
  txt: { type: 'lucide', icon: FileText, colorClass: 'text-zinc-400' },
  log: { type: 'lucide', icon: FileText, colorClass: 'text-zinc-500' },
  csv: { type: 'lucide', icon: FileText, colorClass: 'text-green-400' },
  env: { type: 'lucide', icon: Shield, colorClass: 'text-yellow-600' }
};

const defaultIcon: IconDef = { type: 'lucide', icon: File, colorClass: 'text-zinc-500' };

function getIconDef(filename: string): IconDef {
  if (filenameIcons[filename]) return filenameIcons[filename];

  const lower = filename.toLowerCase();
  if (filenameIcons[lower]) return filenameIcons[lower];

  const lastDot = filename.lastIndexOf('.');
  if (lastDot !== -1) {
    const ext = filename.slice(lastDot + 1).toLowerCase();
    if (extensionIcons[ext]) return extensionIcons[ext];
  }

  return defaultIcon;
}

export function FileTypeIcon({ filename, className }: FileTypeIconProps) {
  const def = getIconDef(filename);

  if (def.type === 'text') {
    return (
      <span
        className={clsx(
          'inline-flex h-4 w-4 shrink-0 items-center justify-center font-mono text-[9px] font-semibold leading-none',
          def.colorClass,
          className
        )}
      >
        {def.label}
      </span>
    );
  }

  const Icon = def.icon;
  return <Icon className={clsx('h-4 w-4 shrink-0', def.colorClass, className)} />;
}
