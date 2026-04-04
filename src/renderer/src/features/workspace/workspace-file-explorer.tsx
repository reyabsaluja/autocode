import { useMemo } from 'react';
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
  const expandedDirectorySet = useMemo(
    () => new Set(expandedDirectories),
    [expandedDirectories]
  );

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
                expandedDirectorySet={expandedDirectorySet}
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
  expandedDirectorySet: ReadonlySet<string>;
  entry: WorkspaceFileTreeEntry;
  onSelectPath: (path: string) => void;
  onToggleDirectory: (path: string) => void;
  selectedPath: string | null;
  taskId: number;
}

type WorkspaceFileTreeEntry =
  | {
      kind: 'directory';
      name: string;
      relativePath: string;
    }
  | {
      kind: 'file';
      name: string;
      relativePath: string;
    };

function WorkspaceFileTreeNode({
  depth,
  expandedDirectorySet,
  entry,
  onSelectPath,
  onToggleDirectory,
  selectedPath,
  taskId
}: WorkspaceFileTreeNodeProps) {
  if (entry.kind === 'directory') {
    return (
      <WorkspaceDirectoryTreeNode
        depth={depth}
        entry={entry}
        expandedDirectorySet={expandedDirectorySet}
        onSelectPath={onSelectPath}
        onToggleDirectory={onToggleDirectory}
        selectedPath={selectedPath}
        taskId={taskId}
      />
    );
  }

  return (
    <WorkspaceFileLeafNode
      depth={depth}
      entry={entry}
      onSelectPath={onSelectPath}
      selectedPath={selectedPath}
    />
  );
}

function WorkspaceDirectoryTreeNode({
  depth,
  entry,
  expandedDirectorySet,
  onSelectPath,
  onToggleDirectory,
  selectedPath,
  taskId
}: WorkspaceFileTreeNodeProps & { entry: WorkspaceFileTreeEntry & { kind: 'directory' } }) {
  const isExpanded = expandedDirectorySet.has(entry.relativePath);
  const childrenQuery = useWorkspaceExplorerDirectoryQuery(taskId, entry.relativePath, isExpanded);
  const isSelected = entry.relativePath === selectedPath;
  const paddingLeft = 8 + depth * 14;

  return (
    <li>
      <WorkspaceTreeButton
        depth={depth}
        icon={isExpanded ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-white/75" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-white/75" />
        )}
        isSelected={isSelected}
        label={entry.name}
        labelClassName="font-medium"
        onMouseDown={(event) => {
          event.preventDefault();
          onToggleDirectory(entry.relativePath);
        }}
      />

      {isExpanded ? (
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
                  expandedDirectorySet={expandedDirectorySet}
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

function WorkspaceFileLeafNode({
  depth,
  entry,
  onSelectPath,
  selectedPath
}: {
  depth: number;
  entry: WorkspaceFileTreeEntry & { kind: 'file' };
  onSelectPath: (path: string) => void;
  selectedPath: string | null;
}) {
  const isSelected = entry.relativePath === selectedPath;

  return (
    <li>
      <WorkspaceTreeButton
        depth={depth}
        icon={<FileTypeIcon filename={entry.name} />}
        isSelected={isSelected}
        label={entry.name}
        onMouseDown={(event) => {
          event.preventDefault();
          onSelectPath(entry.relativePath);
        }}
      />
    </li>
  );
}

function WorkspaceTreeButton({
  depth,
  icon,
  isSelected,
  label,
  labelClassName,
  onMouseDown
}: {
  depth: number;
  icon: React.ReactNode;
  isSelected: boolean;
  label: string;
  labelClassName?: string;
  onMouseDown: (event: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      className={clsx(
        'flex w-full items-center gap-1.5 py-[5px] pr-3 text-left font-geist text-[12px] transition',
        isSelected
          ? 'bg-white/[0.10] text-white'
          : 'text-white hover:bg-white/[0.06]'
      )}
      onMouseDown={onMouseDown}
      style={{ paddingLeft: 8 + depth * 14 }}
      type="button"
    >
      {icon}
      <span className={labelClassName}>{label}</span>
    </button>
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
