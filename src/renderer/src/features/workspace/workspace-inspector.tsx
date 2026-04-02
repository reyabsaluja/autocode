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
  taskWorkspace: TaskWorkspace;
}

export const WorkspaceInspector = forwardRef<WorkspaceEditorHandle, WorkspaceInspectorProps>(
function WorkspaceInspector({ taskWorkspace }: WorkspaceInspectorProps, ref) {
  const editorRef = useRef<WorkspaceEditorHandle | null>(null);
  const taskId = taskWorkspace.task.id;
  const fileController = useWorkspaceFileEditorController({
    editorRef,
    taskId
  });
  const sessionController = useWorkspaceTerminalSessionController({
    activeCenterTab: fileController.activeCenterTab,
    showTerminal: fileController.showTerminal,
    taskId,
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
      <section className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 gap-0">
          <div className="flex min-w-0 flex-1 flex-col">
            <WorkspaceCenterTabBar
              activeCenterTab={fileController.activeCenterTab}
              fileTabs={fileController.fileTabs}
              isNewSessionMenuOpen={sessionController.isNewSessionMenuOpen}
              newSessionButtonDisabled={sessionController.newSessionButtonDisabled}
              newSessionButtonTitle={sessionController.newSessionButtonTitle}
              newSessionMenuRef={sessionController.newSessionMenuRef}
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
              startSessionPending={sessionController.startSessionMutation.isPending}
              terminateSessionPending={sessionController.terminateSessionMutation.isPending}
              toggleNewSessionMenu={sessionController.toggleNewSessionMenu}
            />

            <div className="min-h-0 flex-1">
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
            onCommit={fileController.handleCommit}
            onCommitMessageChange={fileController.setCommitMessage}
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
            selectedPath={fileController.selectedPath}
            taskId={taskId}
          />
        </div>
      </section>

      <UnsavedChangesDialog {...fileController.centerTransitionDialogProps} />
    </>
  );
});
