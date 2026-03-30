import clsx from 'clsx';
import { ChevronDown, ChevronRight, File, Folder, Loader2 } from 'lucide-react';

import { useWorkspaceExplorerDirectoryQuery } from './workspace-hooks';

interface WorkspaceFileExplorerProps {
  expandedDirectories: string[];
  onSelectPath: (path: string) => void;
  onToggleDirectory: (path: string) => void;
  selectedPath: string | null;
  taskId: number;
}

export function WorkspaceFileExplorer({
  expandedDirectories,
  onSelectPath,
  onToggleDirectory,
  selectedPath,
  taskId
}: WorkspaceFileExplorerProps) {
  const rootDirectoryQuery = useWorkspaceExplorerDirectoryQuery(taskId, '');

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-card border border-border bg-surface-1">
      <div className="border-b border-border px-3 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted">
          Workspace files
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-1 py-1">
        {rootDirectoryQuery.isLoading ? (
          <ExplorerMessage>
            <Loader2 className="mr-1.5 inline h-3 w-3 animate-spin" />
            Loading files
          </ExplorerMessage>
        ) : null}

        {rootDirectoryQuery.error ? (
          <ExplorerMessage tone="error">{formatError(rootDirectoryQuery.error)}</ExplorerMessage>
        ) : null}

        {rootDirectoryQuery.data ? (
          <ul>
            {rootDirectoryQuery.data.entries.map((entry) => (
              <WorkspaceFileTreeNode
                key={entry.relativePath}
                depth={0}
                expandedDirectories={expandedDirectories}
                entry={entry}
                onSelectPath={onSelectPath}
                onToggleDirectory={onToggleDirectory}
                selectedPath={selectedPath}
                taskId={taskId}
              />
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

interface WorkspaceFileTreeNodeProps {
  depth: number;
  expandedDirectories: string[];
  entry: {
    kind: 'directory' | 'file';
    name: string;
    relativePath: string;
  };
  onSelectPath: (path: string) => void;
  onToggleDirectory: (path: string) => void;
  selectedPath: string | null;
  taskId: number;
}

function WorkspaceFileTreeNode({
  depth,
  expandedDirectories,
  entry,
  onSelectPath,
  onToggleDirectory,
  selectedPath,
  taskId
}: WorkspaceFileTreeNodeProps) {
  const isDirectory = entry.kind === 'directory';
  const isExpanded = isDirectory && expandedDirectories.includes(entry.relativePath);
  const childrenQuery = useWorkspaceExplorerDirectoryQuery(taskId, entry.relativePath, isExpanded);
  const isSelected = entry.relativePath === selectedPath;
  const paddingLeft = 8 + depth * 14;

  return (
    <li>
      <button
        className={clsx(
          'flex w-full items-center gap-1.5 rounded-control py-[5px] text-left text-[12px] transition',
          isSelected
            ? 'bg-white/[0.08] text-text-primary'
            : 'text-text-secondary hover:bg-white/[0.04] hover:text-text-primary'
        )}
        onClick={() => {
          if (isDirectory) {
            onToggleDirectory(entry.relativePath);
            return;
          }

          onSelectPath(entry.relativePath);
        }}
        style={{ paddingLeft }}
        type="button"
      >
        {isDirectory ? (
          isExpanded ? (
            <ChevronDown className="h-3 w-3 shrink-0 text-text-faint" />
          ) : (
            <ChevronRight className="h-3 w-3 shrink-0 text-text-faint" />
          )
        ) : (
          <File className="h-3 w-3 shrink-0 text-text-faint" />
        )}
        {isDirectory ? (
          <Folder className="h-3 w-3 shrink-0 text-amber-400/70" />
        ) : null}
        <span className={clsx(isDirectory && 'font-medium')}>{entry.name}</span>
      </button>

      {isDirectory && isExpanded ? (
        <div>
          {childrenQuery.isLoading ? (
            <ExplorerMessage paddingLeft={paddingLeft + 22} size="sm">
              <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />
              Loading
            </ExplorerMessage>
          ) : null}

          {childrenQuery.error ? (
            <ExplorerMessage paddingLeft={paddingLeft + 22} size="sm" tone="error">
              {formatError(childrenQuery.error)}
            </ExplorerMessage>
          ) : null}

          {childrenQuery.data ? (
            <ul>
              {childrenQuery.data.entries.map((childEntry) => (
                <WorkspaceFileTreeNode
                  key={childEntry.relativePath}
                  depth={depth + 1}
                  expandedDirectories={expandedDirectories}
                  entry={childEntry}
                  onSelectPath={onSelectPath}
                  onToggleDirectory={onToggleDirectory}
                  selectedPath={selectedPath}
                  taskId={taskId}
                />
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function ExplorerMessage({
  children,
  paddingLeft = 8,
  size = 'default',
  tone = 'subtle'
}: {
  children: React.ReactNode;
  paddingLeft?: number;
  size?: 'default' | 'sm';
  tone?: 'error' | 'subtle';
}) {
  return (
    <p
      className={clsx(
        'py-1.5',
        size === 'sm' ? 'text-[11px]' : 'text-[12px]',
        tone === 'error' ? 'text-rose-400' : 'text-text-faint'
      )}
      style={{ paddingLeft }}
    >
      {children}
    </p>
  );
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : 'Autocode could not read this directory.';
}
