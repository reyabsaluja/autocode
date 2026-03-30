import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Files, GitCompare, RefreshCw } from 'lucide-react';

import type { TaskWorkspace } from '@shared/domain/task-workspace';

import { UnsavedChangesDialog } from '../editor/unsaved-changes-dialog';
import { useUnsavedChangesGuard } from '../editor/use-unsaved-changes-guard';
import {
  WorkspaceEditorSurface,
  type WorkspaceEditorHandle
} from '../editor/workspace-editor-surface';
import { queryKeys } from '../../lib/query-keys';
import {
  useCommitWorkspaceMutation,
  useWorkspaceChangesQuery
} from './workspace-hooks';
import { WorkspaceChangesPanel } from './workspace-changes-panel';
import { WorkspaceFileExplorer } from './workspace-file-explorer';

interface WorkspaceInspectorProps {
  taskWorkspace: TaskWorkspace;
}

export const WorkspaceInspector = forwardRef<WorkspaceEditorHandle, WorkspaceInspectorProps>(
function WorkspaceInspector({ taskWorkspace }: WorkspaceInspectorProps, ref) {
  const queryClient = useQueryClient();
  const editorRef = useRef<WorkspaceEditorHandle | null>(null);
  const taskId = taskWorkspace.task.id;
  const changesQuery = useWorkspaceChangesQuery(taskId);
  const commitMutation = useCommitWorkspaceMutation(taskId);
  const [activeSidebarTab, setActiveSidebarTab] = useState<'changes' | 'files'>('files');
  const [centerMode, setCenterMode] = useState<'diff' | 'editor'>('editor');
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState<'changes' | 'files'>('files');
  const [expandedDirectories, setExpandedDirectories] = useState<string[]>([]);
  const [commitMessage, setCommitMessage] = useState('');
  const [commitNotice, setCommitNotice] = useState<string | null>(null);
  const changes = changesQuery.data ?? [];
  const { dialogProps: fileSwitchDialogProps, requestTransition: requestFileTransition } =
    useUnsavedChangesGuard(editorRef);
  const activeChange = useMemo(
    () => changes.find((change) => change.relativePath === selectedPath) ?? null,
    [changes, selectedPath]
  );

  useImperativeHandle(
    ref,
    () => ({
      discardUnsavedChanges: () => editorRef.current?.discardUnsavedChanges(),
      getActiveFilePath: () => editorRef.current?.getActiveFilePath() ?? null,
      hasUnsavedChanges: () => editorRef.current?.hasUnsavedChanges() ?? false,
      saveActiveFile: async () => (await editorRef.current?.saveActiveFile()) ?? false
    }),
    []
  );

  useEffect(() => {
    setActiveSidebarTab('files');
    setCenterMode('editor');
    setSelectedPath(null);
    setSelectionMode('files');
    setExpandedDirectories([]);
    setCommitMessage('');
    setCommitNotice(null);
    commitMutation.reset();
  }, [taskId]);

  useEffect(() => {
    if (selectionMode !== 'changes') {
      return;
    }

    if (changes.length === 0) {
      if (!editorRef.current?.hasUnsavedChanges()) {
        setSelectedPath(null);
      }

      return;
    }

    if (selectedPath && changes.some((change) => change.relativePath === selectedPath)) {
      return;
    }

    const nextPath = changes[0]?.relativePath ?? null;

    if (!nextPath) {
      return;
    }

    requestFileSelection(nextPath, 'changes', 'diff');
  }, [changes, selectedPath, selectionMode]);

  const handleRefresh = async () => {
    setCommitNotice(null);
    commitMutation.reset();
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

  function requestFileSelection(
    path: string,
    nextSelectionMode: 'changes' | 'files',
    nextCenterMode: 'diff' | 'editor'
  ) {
    if (path === selectedPath) {
      setSelectionMode(nextSelectionMode);
      setCenterMode(nextCenterMode);
      return;
    }

    requestFileTransition({
      body: `Save or discard your changes to ${
        editorRef.current?.getActiveFilePath() ?? 'the current file'
      } before opening another file.`,
      key: `file:${taskId}:${path}:${nextSelectionMode}:${nextCenterMode}`,
      run: () => {
        applyFileSelection(path, nextSelectionMode, nextCenterMode);
      },
      title: 'Unsaved file edits'
    });
  }

  function applyFileSelection(
    path: string,
    nextSelectionMode: 'changes' | 'files',
    nextCenterMode: 'diff' | 'editor'
  ) {
    setSelectedPath(path);
    setSelectionMode(nextSelectionMode);
    setCenterMode(nextCenterMode);
  }

  return (
    <>
    <section className="grid min-h-0 flex-1 gap-2.5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0">
        <WorkspaceEditorSurface
          ref={editorRef}
          activeChange={activeChange}
          activeFilePath={selectedPath}
          mode={centerMode}
          onModeChange={setCenterMode}
          taskId={taskId}
        />
      </div>

      <aside className="flex min-h-0 flex-col overflow-hidden rounded-panel border border-border bg-surface-2 shadow-panel">
        <div className="flex items-center gap-0.5 border-b border-border px-2 py-1.5">
          <SidebarTab
            icon={<Files className="h-3.5 w-3.5" />}
            isActive={activeSidebarTab === 'files'}
            label="Files"
            onClick={() => setActiveSidebarTab('files')}
          />
          <SidebarTab
            icon={<GitCompare className="h-3.5 w-3.5" />}
            isActive={activeSidebarTab === 'changes'}
            label="Changes"
            onClick={() => {
              setSelectionMode('changes');
              setActiveSidebarTab('changes');
            }}
          />
          <div className="ml-auto">
            <button
              className="grid h-7 w-7 place-items-center rounded-control text-text-faint transition hover:bg-white/[0.06] hover:text-text-secondary"
              onClick={() => { void handleRefresh(); }}
              title="Refresh"
              type="button"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden p-2">
          {activeSidebarTab === 'files' ? (
            <WorkspaceFileExplorer
              expandedDirectories={expandedDirectories}
              onToggleDirectory={toggleDirectory}
              onSelectPath={(path) => {
                requestFileSelection(path, 'files', 'editor');
              }}
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
                requestFileSelection(path, 'changes', 'diff');
                setActiveSidebarTab('changes');
              }}
              selectedPath={selectedPath}
            />
          )}
        </div>
      </aside>
    </section>
      <UnsavedChangesDialog
        {...fileSwitchDialogProps}
      />
    </>
  );
});

function SidebarTab({
  icon,
  isActive,
  label,
  onClick
}: {
  icon: React.ReactNode;
  isActive: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={clsx(
        'flex items-center gap-1.5 rounded-control px-2.5 py-1.5 text-[12px] font-medium transition',
        isActive
          ? 'bg-white/[0.08] text-text-primary'
          : 'text-text-muted hover:bg-white/[0.04] hover:text-text-secondary'
      )}
      onClick={onClick}
      type="button"
    >
      {icon}
      {label}
    </button>
  );
}

function formatError(error: unknown): string | null {
  return error instanceof Error ? error.message : null;
}
