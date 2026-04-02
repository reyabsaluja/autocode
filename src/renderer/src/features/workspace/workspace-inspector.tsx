import { forwardRef, useImperativeHandle, useRef } from 'react';

import type { TaskWorkspace } from '@shared/domain/task-workspace';

import { WorkspaceTerminalSurface } from '../agent-sessions/workspace-terminal-surface';
import { UnsavedChangesDialog } from '../editor/unsaved-changes-dialog';
import {
  WorkspaceEditorSurface,
  type WorkspaceEditorHandle
} from '../editor/workspace-editor-surface';
import { WorkspaceCenterTabBar } from './workspace-center-tab-bar';
import { WorkspaceInspectorSidebar } from './workspace-inspector-sidebar';
import { TERMINAL_TAB_ID } from './workspace-inspector-shared';
import { useWorkspaceFileEditorController } from './use-workspace-file-editor-controller';
import { useWorkspaceTerminalSessionController } from './use-workspace-terminal-session-controller';

interface WorkspaceInspectorProps {
  onRequestTaskSelection: (taskId: number) => void;
  taskWorkspace: TaskWorkspace;
}

export const WorkspaceInspector = forwardRef<WorkspaceEditorHandle, WorkspaceInspectorProps>(
function WorkspaceInspector({ onRequestTaskSelection, taskWorkspace }: WorkspaceInspectorProps, ref) {
  const editorRef = useRef<WorkspaceEditorHandle | null>(null);
  const taskId = taskWorkspace.task.id;
  const fileController = useWorkspaceFileEditorController({
    editorRef,
    taskId
  });
  const sessionController = useWorkspaceTerminalSessionController({
    activeCenterTab: fileController.activeCenterTab,
    onRequestTaskSelection,
    showTerminal: fileController.showTerminal,
    taskId,
    taskWorkspace,
    runWithCenterTransition: fileController.runWithCenterTransition
  });

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

  return (
    <>
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_300px] overflow-hidden">
          <div className="relative z-0 flex min-w-0 flex-1 flex-col overflow-hidden isolate">
            <WorkspaceCenterTabBar
              activeCenterTab={fileController.activeCenterTab}
              fileTabs={fileController.fileTabs}
              onCloseFileTab={fileController.requestCloseFileTab}
              onDeleteSession={sessionController.requestDeleteSession}
              onRequestFileTabActivation={fileController.requestFileTabActivation}
              onRequestSessionSelection={sessionController.requestSessionSelection}
              onRequestStartSession={sessionController.requestStartSession}
              onRequestTerminalSelection={fileController.requestTerminalSelection}
              onTerminateSession={() => {
                void sessionController.terminateSessionMutation.mutateAsync();
              }}
              selectedSessionId={sessionController.selectedSessionId}
              selectedSessionIsActive={sessionController.selectedSessionIsActive}
              sessions={sessionController.sessions}
              startSessionPending={sessionController.startSessionPending}
              terminateSessionPending={sessionController.terminateSessionMutation.isPending}
            />

            <div className="relative z-0 min-h-0 min-w-0 flex-1 overflow-hidden isolate">
              {fileController.activeCenterTab === TERMINAL_TAB_ID ? (
                <WorkspaceTerminalSurface
                  {...sessionController.terminalSurfaceProps}
                />
              ) : (
                <WorkspaceEditorSurface
                  ref={editorRef}
                  activeChange={fileController.activeChange}
                  activeFilePath={fileController.selectedPath}
                  mode={fileController.activeFileTab?.mode ?? 'editor'}
                  onModeChange={fileController.updateActiveFileTabMode}
                  taskId={taskId}
                />
              )}
            </div>
          </div>

          <WorkspaceInspectorSidebar
            activeSidebarTab={fileController.activeSidebarTab}
            changes={fileController.changes}
            changesLoadErrorMessage={fileController.changesLoadErrorMessage}
            commitErrorMessage={fileController.commitErrorMessage}
            commitMessage={fileController.commitMessage}
            commitNotice={fileController.commitNotice}
            commits={fileController.commits}
            commitsLoadErrorMessage={fileController.commitsLoadErrorMessage}
            expandedDirectories={fileController.expandedDirectories}
            isCommitting={fileController.commitMutation.isPending}
            isLoadingChanges={fileController.isLoadingChanges}
            isLoadingCommits={fileController.isLoadingCommits}
            isLoadingPublishStatus={fileController.isLoadingPublishStatus}
            isCreatingPullRequest={fileController.isCreatingPullRequest}
            isOpeningPullRequest={fileController.isOpeningPullRequest}
            isPushing={fileController.isPushing}
            onCommit={fileController.handleCommit}
            onCreatePullRequest={fileController.handleCreatePullRequest}
            onCommitMessageChange={fileController.setCommitMessage}
            onOpenPullRequest={fileController.handleOpenPullRequest}
            onPush={fileController.handlePush}
            onRefresh={fileController.handleRefresh}
            onSelectChange={(path) => {
              fileController.requestFileSelection(path, 'changes', 'diff');
              fileController.setActiveSidebarTab('changes');
            }}
            onSelectFile={(path) => {
              fileController.requestFileSelection(path, 'files', 'editor');
            }}
            onSelectSidebarTab={fileController.setActiveSidebarTab}
            onToggleDirectory={fileController.toggleDirectory}
            reviewStatus={fileController.reviewStatus}
            publishStatusErrorMessage={fileController.publishStatusErrorMessage}
            selectedPath={fileController.selectedPath}
            taskId={taskId}
          />
        </div>
      </section>

      <UnsavedChangesDialog {...fileController.centerTransitionDialogProps} />
    </>
  );
});
