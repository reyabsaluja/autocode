import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import type { TaskWorkspace } from '@shared/domain/task-workspace';

import { queryKeys } from '../../lib/query-keys';
import {
  useCommitWorkspaceMutation,
  useWorkspaceChangesQuery,
  useWorkspaceDiffQuery
} from './workspace-hooks';
import { WorkspaceChangesPanel } from './workspace-changes-panel';
import { WorkspaceDiffViewer } from './workspace-diff-viewer';
import { WorkspaceFileExplorer } from './workspace-file-explorer';

interface WorkspaceInspectorProps {
  taskWorkspace: TaskWorkspace;
}

export function WorkspaceInspector({ taskWorkspace }: WorkspaceInspectorProps) {
  const queryClient = useQueryClient();
  const taskId = taskWorkspace.task.id;
  const changesQuery = useWorkspaceChangesQuery(taskId);
  const commitMutation = useCommitWorkspaceMutation(taskId);
  const [activeSidebarTab, setActiveSidebarTab] = useState<'changes' | 'files'>('changes');
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [expandedDirectories, setExpandedDirectories] = useState<string[]>([]);
  const [commitMessage, setCommitMessage] = useState('');
  const [commitNotice, setCommitNotice] = useState<string | null>(null);
  const changes = changesQuery.data ?? [];
  const diffQuery = useWorkspaceDiffQuery(taskId, selectedPath);

  useEffect(() => {
    setActiveSidebarTab('changes');
    setSelectedPath(null);
    setExpandedDirectories([]);
    setCommitMessage('');
    setCommitNotice(null);
    commitMutation.reset();
  }, [taskId]);

  useEffect(() => {
    if (changes.length === 0) {
      setSelectedPath(null);
      return;
    }

    setSelectedPath((currentPath) => currentPath ?? changes[0]?.relativePath ?? null);
  }, [changes]);

  const handleRefresh = async () => {
    setCommitNotice(null);
    await queryClient.invalidateQueries({ queryKey: queryKeys.workspace(taskId) });
    await queryClient.invalidateQueries({ queryKey: ['tasks'] });
  };

  const handleCommit = async () => {
    try {
      const result = await commitMutation.mutateAsync({ message: commitMessage });
      setCommitNotice(`Committed ${result.commitSha.slice(0, 7)} on this workspace branch.`);
      setCommitMessage('');
    } catch {
      // The mutation error is rendered in the panel.
    }
  };

  const toggleDirectory = (directoryPath: string) => {
    setExpandedDirectories((current) =>
      current.includes(directoryPath)
        ? current.filter((entry) => entry !== directoryPath)
        : [...current, directoryPath]
    );
  };

  return (
    <section className="grid min-h-[calc(100vh-120px)] gap-3 xl:grid-cols-[minmax(0,1fr),360px]">
      <div className="min-w-0">
        <WorkspaceDiffViewer
          diffText={diffQuery.data?.text ?? null}
          errorMessage={formatError(diffQuery.error)}
          isLoading={diffQuery.isLoading}
          selectedPath={selectedPath}
        />
      </div>

      <aside className="flex min-h-0 flex-col overflow-hidden rounded-[24px] border border-white/8 bg-[#121316] shadow-[0_24px_80px_rgba(0,0,0,0.32)]">
        <div className="flex items-center gap-1 border-b border-white/6 px-3 py-3">
          <SidebarTab
            isActive={activeSidebarTab === 'files'}
            label="Files"
            onClick={() => setActiveSidebarTab('files')}
          />
          <SidebarTab
            isActive={activeSidebarTab === 'changes'}
            label="Changes"
            onClick={() => setActiveSidebarTab('changes')}
          />
        </div>

        <div className="min-h-0 flex-1 overflow-hidden p-3">
          {activeSidebarTab === 'files' ? (
            <WorkspaceFileExplorer
              expandedDirectories={expandedDirectories}
              onSelectPath={setSelectedPath}
              onToggleDirectory={toggleDirectory}
              selectedPath={selectedPath}
              taskId={taskId}
            />
          ) : (
            <WorkspaceChangesPanel
              changes={changes}
              commitErrorMessage={formatError(commitMutation.error)}
              commitMessage={commitMessage}
              commitNotice={commitNotice}
              isCommitting={commitMutation.isPending}
              isLoading={changesQuery.isLoading}
              loadErrorMessage={formatError(changesQuery.error)}
              onCommit={handleCommit}
              onCommitMessageChange={setCommitMessage}
              onRefresh={handleRefresh}
              onSelectChange={(path) => {
                setSelectedPath(path);
                setActiveSidebarTab('changes');
              }}
              selectedPath={selectedPath}
            />
          )}
        </div>
      </aside>
    </section>
  );
}

function SidebarTab({
  isActive,
  label,
  onClick
}: {
  isActive: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
        isActive
          ? 'bg-white/[0.08] text-white'
          : 'text-slate-500 hover:bg-white/[0.04] hover:text-slate-200'
      }`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function formatError(error: unknown): string | null {
  return error instanceof Error ? error.message : null;
}
