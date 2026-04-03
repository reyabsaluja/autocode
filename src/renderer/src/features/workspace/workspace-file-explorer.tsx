import clsx from 'clsx';
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react';

import { FileTypeIcon } from '../../lib/file-type-icon';
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
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-auto py-1">
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
          'flex w-full items-center gap-1.5 py-[5px] pr-3 text-left font-geist text-[12px] transition',
          isSelected
            ? 'bg-white/[0.10] text-white'
            : 'text-white/75 hover:bg-white/[0.06] hover:text-white/90'
        )}
        onMouseDown={(event) => {
          event.preventDefault();

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
            <ChevronDown className="h-3 w-3 shrink-0 text-white/30" />
          ) : (
            <ChevronRight className="h-3 w-3 shrink-0 text-white/30" />
          )
        ) : (
          <FileTypeIcon filename={entry.name} />
        )}
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
  paddingLeft = 12,
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
        'py-1.5 font-geist',
        size === 'sm' ? 'text-[11px]' : 'text-[12px]',
        tone === 'error' ? 'text-rose-300' : 'text-white/40'
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
