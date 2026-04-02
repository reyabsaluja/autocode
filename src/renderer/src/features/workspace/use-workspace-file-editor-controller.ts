import { useEffect, useMemo, useState, type RefObject } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import type { WorkspaceEditorHandle } from '../editor/workspace-editor-surface';
import { useUnsavedChangesGuard } from '../editor/use-unsaved-changes-guard';
import {
  basename,
  formatWorkspaceInspectorError,
  TERMINAL_TAB_ID,
  type WorkspaceCenterTransitionRequest,
  type WorkspaceFileTab
} from './workspace-inspector-shared';
import { queryKeys } from '../../lib/query-keys';
import {
  useCommitWorkspaceMutation,
  useWorkspaceChangesQuery
} from './workspace-hooks';

interface UseWorkspaceFileEditorControllerInput {
  editorRef: RefObject<WorkspaceEditorHandle | null>;
  taskId: number;
}

export function useWorkspaceFileEditorController({
  editorRef,
  taskId
}: UseWorkspaceFileEditorControllerInput) {
  const queryClient = useQueryClient();
  const changesQuery = useWorkspaceChangesQuery(taskId);
  const commitMutation = useCommitWorkspaceMutation(taskId);
  const { dialogProps, requestTransition } = useUnsavedChangesGuard(editorRef);
  const [activeSidebarTab, setActiveSidebarTab] = useState<'changes' | 'files'>('files');
  const [activeCenterTab, setActiveCenterTab] = useState<string>(TERMINAL_TAB_ID);
  const [fileTabs, setFileTabs] = useState<WorkspaceFileTab[]>([]);
  const [expandedDirectories, setExpandedDirectories] = useState<string[]>([]);
  const [commitMessage, setCommitMessage] = useState('');
  const [commitNotice, setCommitNotice] = useState<string | null>(null);
  const changes = changesQuery.data?.changes ?? [];
  const commits = changesQuery.data?.commits ?? [];
  const activeFileTab = useMemo(
    () => fileTabs.find((tab) => tab.path === activeCenterTab) ?? null,
    [activeCenterTab, fileTabs]
  );
  const selectedPath = activeFileTab?.path ?? null;
  const activeChange = useMemo(
    () => changes.find((change) => change.relativePath === selectedPath) ?? null,
    [changes, selectedPath]
  );

  useEffect(() => {
    setActiveSidebarTab('files');
    setActiveCenterTab(TERMINAL_TAB_ID);
    setFileTabs([]);
    setExpandedDirectories([]);
    setCommitMessage('');
    setCommitNotice(null);
    commitMutation.reset();
  }, [commitMutation, taskId]);

  useEffect(() => {
    if (!activeFileTab || activeFileTab.selectionMode !== 'changes') {
      return;
    }

    if (changes.length === 0) {
      if (!editorRef.current?.hasUnsavedChanges()) {
        applyCloseFileTab(activeFileTab.path);
      }

      return;
    }

    if (changes.some((change) => change.relativePath === activeFileTab.path)) {
      return;
    }

    const nextPath = changes[0]?.relativePath ?? null;

    if (!nextPath) {
      return;
    }

    requestFileSelection(nextPath, 'changes', 'diff');
  }, [activeFileTab, changes, editorRef]);

  const handleRefresh = async () => {
    setCommitNotice(null);
    commitMutation.reset();
    await queryClient.invalidateQueries({ queryKey: queryKeys.workspace(taskId) });
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
    if (
      activeFileTab &&
      activeFileTab.path === path &&
      activeFileTab.mode === nextCenterMode &&
      activeCenterTab === path
    ) {
      return;
    }

    runWithCenterTransition({
      body: `Save or discard your changes to ${
        editorRef.current?.getActiveFilePath() ?? 'the current file'
      } before opening another tab.`,
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
    setFileTabs((current) => {
      const existingTab = current.find((tab) => tab.path === path);

      if (existingTab) {
        return current.map((tab) =>
          tab.path === path
            ? {
                ...tab,
                mode: nextCenterMode,
                selectionMode: nextSelectionMode
              }
            : tab
        );
      }

      return [
        ...current,
        {
          mode: nextCenterMode,
          path,
          selectionMode: nextSelectionMode
        }
      ];
    });
    setActiveCenterTab(path);
  }

  function requestTerminalSelection() {
    if (activeCenterTab === TERMINAL_TAB_ID) {
      return;
    }

    runWithCenterTransition({
      body: `Save or discard your changes to ${
        editorRef.current?.getActiveFilePath() ?? 'the current file'
      } before returning to the terminal.`,
      key: `terminal:${taskId}`,
      run: () => {
        setActiveCenterTab(TERMINAL_TAB_ID);
      },
      title: 'Unsaved file edits'
    });
  }

  function showTerminal() {
    setActiveCenterTab(TERMINAL_TAB_ID);
  }

  function requestFileTabActivation(path: string) {
    if (activeCenterTab === path) {
      return;
    }

    runWithCenterTransition({
      body: `Save or discard your changes to ${
        editorRef.current?.getActiveFilePath() ?? 'the current file'
      } before switching tabs.`,
      key: `tab:${taskId}:${path}`,
      run: () => {
        setActiveCenterTab(path);
      },
      title: 'Unsaved file edits'
    });
  }

  function requestCloseFileTab(path: string) {
    if (activeCenterTab !== path) {
      applyCloseFileTab(path);
      return;
    }

    runWithCenterTransition({
      body: `Save or discard your changes to ${
        editorRef.current?.getActiveFilePath() ?? 'the current file'
      } before closing this tab.`,
      key: `close:${taskId}:${path}`,
      run: () => {
        applyCloseFileTab(path);
      },
      title: 'Unsaved file edits'
    });
  }

  function applyCloseFileTab(path: string) {
    setFileTabs((current) => {
      const tabIndex = current.findIndex((tab) => tab.path === path);

      if (tabIndex === -1) {
        return current;
      }

      const nextTabs = current.filter((tab) => tab.path !== path);

      if (activeCenterTab === path) {
        const fallbackTab = nextTabs[tabIndex - 1] ?? nextTabs[tabIndex] ?? null;
        setActiveCenterTab(fallbackTab?.path ?? TERMINAL_TAB_ID);
      }

      return nextTabs;
    });
  }

  function updateActiveFileTabMode(nextMode: 'diff' | 'editor') {
    if (!activeFileTab) {
      return;
    }

    setFileTabs((current) =>
      current.map((tab) =>
        tab.path === activeFileTab.path
          ? {
              ...tab,
              mode: nextMode
            }
          : tab
      )
    );
  }

  function runWithCenterTransition(input: WorkspaceCenterTransitionRequest) {
    if (activeCenterTab === TERMINAL_TAB_ID || !editorRef.current?.hasUnsavedChanges()) {
      input.run();
      return;
    }

    requestTransition(input);
  }

  return {
    activeCenterTab,
    activeChange,
    activeFileTab,
    activeSidebarTab,
    centerTransitionDialogProps: dialogProps,
    changes,
    changesLoadErrorMessage: formatWorkspaceInspectorError(changesQuery.error),
    changesQuery,
    commitErrorMessage: formatWorkspaceInspectorError(commitMutation.error),
    commitMessage,
    commitMutation,
    commitNotice,
    commits,
    fileTabLabels: fileTabs.map((tab) => ({
      path: tab.path,
      label: basename(tab.path)
    })),
    fileTabs,
    expandedDirectories,
    handleCommit,
    handleRefresh,
    isLoadingChanges: changesQuery.isLoading,
    requestCloseFileTab,
    requestFileSelection,
    requestFileTabActivation,
    requestTerminalSelection,
    runWithCenterTransition,
    selectedPath,
    setActiveSidebarTab,
    setCommitMessage,
    showTerminal,
    toggleDirectory,
    updateActiveFileTabMode
  };
}

export type WorkspaceFileEditorController = ReturnType<typeof useWorkspaceFileEditorController>;
