import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

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
    <section className="grid min-h-[calc(100vh-120px)] gap-3 xl:grid-cols-[minmax(0,1fr),360px]">
      <div className="min-w-0">
        <WorkspaceEditorSurface
          ref={editorRef}
          activeFilePath={selectedPath}
          mode={centerMode}
          onModeChange={setCenterMode}
          taskId={taskId}
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
            onClick={() => {
              setSelectionMode('changes');
              setActiveSidebarTab('changes');
            }}
          />
          <div className="ml-auto">
            <button
              className="rounded-xl px-3 py-2 text-sm font-medium text-slate-500 transition hover:bg-white/[0.04] hover:text-slate-200"
              onClick={() => {
                void handleRefresh();
              }}
              type="button"
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden p-3">
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
