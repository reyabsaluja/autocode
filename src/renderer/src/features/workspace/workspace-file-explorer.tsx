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
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[20px] border border-white/6 bg-[#0d0e11]">
      <div className="border-b border-white/6 px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
          Workspace files
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-2 py-2">
        {rootDirectoryQuery.isLoading ? <ExplorerMessage label="Loading files" /> : null}

        {rootDirectoryQuery.error ? (
          <ExplorerMessage label={formatError(rootDirectoryQuery.error)} tone="error" />
        ) : null}

        {rootDirectoryQuery.data ? (
          <ul className="space-y-1">
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
  const paddingLeft = 12 + depth * 16;

  return (
    <li>
      <button
        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition ${
          isSelected
            ? 'bg-white/[0.08] text-white'
            : 'text-slate-300 hover:bg-white/[0.04]'
        }`}
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
        <span className="w-4 text-center text-slate-500">
          {isDirectory ? (isExpanded ? '▾' : '▸') : '•'}
        </span>
        <span className={isDirectory ? 'font-medium text-slate-100' : ''}>{entry.name}</span>
      </button>

      {isDirectory && isExpanded ? (
        <div className="mt-1">
          {childrenQuery.isLoading ? (
            <ExplorerMessage
              label="Loading folder"
              paddingLeft={paddingLeft + 28}
              tone="subtle"
            />
          ) : null}

          {childrenQuery.error ? (
            <ExplorerMessage
              label={formatError(childrenQuery.error)}
              paddingLeft={paddingLeft + 28}
              tone="error"
            />
          ) : null}

          {childrenQuery.data ? (
            <ul className="space-y-1">
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
  label,
  paddingLeft = 12,
  tone = 'subtle'
}: {
  label: string;
  paddingLeft?: number;
  tone?: 'error' | 'subtle';
}) {
  return (
    <p
      className={`py-2 text-sm ${tone === 'error' ? 'text-rose-300' : 'text-slate-500'}`}
      style={{ paddingLeft }}
    >
      {label}
    </p>
  );
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : 'Autocode could not read this directory.';
}
