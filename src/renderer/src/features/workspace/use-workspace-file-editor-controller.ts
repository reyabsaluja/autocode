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
  useCreatePullRequestMutation,
  useWorkspaceChangesQuery,
  useWorkspacePublishStatusQuery,
  useWorkspaceRecentCommitsQuery,
  useWorkspaceInspectionStream,
  useOpenPullRequestMutation,
  usePushWorkspaceBranchMutation
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
  const [activeSidebarTab, setActiveSidebarTab] = useState<'changes' | 'files'>('files');
  useWorkspaceInspectionStream(taskId);
  const changesQuery = useWorkspaceChangesQuery(taskId);
  const recentCommitsQuery = useWorkspaceRecentCommitsQuery(taskId, activeSidebarTab === 'changes');
  const publishStatusQuery = useWorkspacePublishStatusQuery(taskId, activeSidebarTab === 'changes');
  const commitMutation = useCommitWorkspaceMutation(taskId);
  const createPullRequestMutation = useCreatePullRequestMutation(taskId);
  const openPullRequestMutation = useOpenPullRequestMutation(taskId);
  const pushMutation = usePushWorkspaceBranchMutation(taskId);
  const { dialogProps, requestTransition } = useUnsavedChangesGuard(editorRef);
  const [activeCenterTab, setActiveCenterTab] = useState<string>(TERMINAL_TAB_ID);
  const [fileTabs, setFileTabs] = useState<WorkspaceFileTab[]>([]);
  const [expandedDirectories, setExpandedDirectories] = useState<string[]>([]);
  const [commitMessage, setCommitMessage] = useState('');
  const [commitNotice, setCommitNotice] = useState<string | null>(null);
  const changes = changesQuery.data?.changes ?? [];
  const commits = recentCommitsQuery.data ?? [];
  const reviewStatus = publishStatusQuery.data ?? null;
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
    createPullRequestMutation.reset();
    openPullRequestMutation.reset();
    pushMutation.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mutation objects are intentionally excluded; including them causes a reset loop because useMutation returns new object references.
  }, [taskId]);

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
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.workspace(taskId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaceRecentCommits(taskId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.workspacePublishStatus(taskId) })
    ]);
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

  const handlePush = async () => {
    try {
      const result = await pushMutation.mutateAsync();
      const destination = result.publish.upstreamBranch ?? (
        result.publish.remoteName
          ? `${result.publish.remoteName}/${result.publish.branchName}`
          : result.publish.branchName
      );
      setCommitNotice(`Pushed ${result.publish.branchName} to ${destination}.`);
    } catch {
      // The mutation error is rendered in the panel.
    }
  };

  const handleCreatePullRequest = async () => {
    try {
      const result = await createPullRequestMutation.mutateAsync();
      const pullRequest = result.pullRequest;

      if (pullRequest.number && pullRequest.url) {
        setCommitNotice(`Created PR #${pullRequest.number}: ${pullRequest.url}`);
        return;
      }

      setCommitNotice('Created a pull request for this task branch.');
    } catch {
      // The mutation error is rendered in the panel.
    }
  };

  const handleOpenPullRequest = async () => {
    try {
      await openPullRequestMutation.mutateAsync();
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
    commitErrorMessage:
      formatWorkspaceInspectorError(commitMutation.error) ??
      formatWorkspaceInspectorError(createPullRequestMutation.error) ??
      formatWorkspaceInspectorError(openPullRequestMutation.error) ??
      formatWorkspaceInspectorError(pushMutation.error),
    commitMessage,
    commitMutation,
    commitNotice,
    commits,
    commitsLoadErrorMessage: formatWorkspaceInspectorError(recentCommitsQuery.error),
    isLoadingCommits: recentCommitsQuery.isLoading,
    fileTabLabels: fileTabs.map((tab) => ({
      path: tab.path,
      label: basename(tab.path)
    })),
    fileTabs,
    expandedDirectories,
    handleCommit,
    handleCreatePullRequest,
    handleOpenPullRequest,
    handlePush,
    handleRefresh,
    isLoadingChanges: changesQuery.isLoading,
    isLoadingPublishStatus: publishStatusQuery.isLoading,
    isCreatingPullRequest: createPullRequestMutation.isPending,
    isOpeningPullRequest: openPullRequestMutation.isPending,
    isPushing: pushMutation.isPending,
    reviewStatus,
    publishStatusErrorMessage: formatWorkspaceInspectorError(publishStatusQuery.error),
    createPullRequestMutation,
    openPullRequestMutation,
    pushMutation,
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
