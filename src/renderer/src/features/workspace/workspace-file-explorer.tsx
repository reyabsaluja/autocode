import { useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { FileTree, useFileTree, useFileTreeSelection } from '@pierre/trees/react';

import { useWorkspaceAllPathsQuery } from './workspace-hooks';

interface WorkspaceFileExplorerProps {
  onSelectPath: (path: string) => void;
  selectedPath: string | null;
  taskId: number;
}

export function WorkspaceFileExplorer({
  onSelectPath,
  selectedPath,
  taskId
}: WorkspaceFileExplorerProps) {
  const allPathsQuery = useWorkspaceAllPathsQuery(taskId);
  const paths = allPathsQuery.data?.paths ?? [];

  const { model } = useFileTree({
    flattenEmptyDirectories: true,
    initialExpansion: 1,
    paths,
    onSelectionChange: (selectedPaths) => {
      const selected = selectedPaths[0];
      if (selected && !selected.endsWith('/')) {
        onSelectPath(selected);
      }
    }
  });

  const modelRef = useRef(model);
  modelRef.current = model;

  useEffect(() => {
    if (selectedPath) {
      model.focusPath(selectedPath);
    }
  }, [selectedPath, model]);

  if (allPathsQuery.isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-4 text-[12px] text-white/40">
        <Loader2 className="h-3 w-3 animate-spin" />
        Loading files
      </div>
    );
  }

  if (allPathsQuery.error) {
    return (
      <div className="px-3 py-4 text-[12px] text-rose-300">
        {allPathsQuery.error instanceof Error
          ? allPathsQuery.error.message
          : 'Could not load file tree.'}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <FileTree
        model={model}
        style={{ height: '100%' }}
      />
    </div>
  );
}
