import { useState, useRef } from 'react';
import { PanelLeft } from 'lucide-react';

import type { WorkspaceEditorHandle } from '../features/editor/workspace-editor-surface';
import { UnsavedChangesDialog } from '../features/editor/unsaved-changes-dialog';
import { useAddProjectMutation, useProjectsQuery } from '../features/projects/project-hooks';
import { WorkspaceDetails } from '../features/tasks/workspace-details';
import { autocodeApi } from '../lib/autocode-api';
import { WorkspaceSidebar } from '../features/workspace/workspace-sidebar';
import { useWorkspaceSessionController } from './use-workspace-session-controller';

export function App() {
  const editorRef = useRef<WorkspaceEditorHandle | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const projectsQuery = useProjectsQuery();
  const addProjectMutation = useAddProjectMutation();
  const [projectActionError, setProjectActionError] = useState<string | null>(null);
  const [manualRepositoryPath, setManualRepositoryPath] = useState('');

  const projects = projectsQuery.data ?? [];
  const workspaceSession = useWorkspaceSessionController({
    editorRef,
    projects
  });
  const projectLoadError = formatErrorMessage(projectsQuery.error);
  const taskLoadError = formatErrorMessage(workspaceSession.taskWorkspacesQuery.error);

  const handleAddRepository = async () => {
    try {
      resetProjectActionState();
      const selectedPath = await autocodeApi.projects.pickPath();

      if (!selectedPath) {
        return;
      }

      await connectProjectPath(selectedPath);
    } catch (error) {
      setProjectActionError(
        error instanceof Error ? error.message : 'Autocode could not open the repository picker.'
      );
    }
  };

  const handleManualRepositoryAdd = async () => {
    const path = manualRepositoryPath.trim();

    if (!path) {
      return;
    }

    try {
      resetProjectActionState();
      await connectProjectPath(path);
    } catch (error) {
      setProjectActionError(
        error instanceof Error
          ? error.message
          : 'Autocode could not add that repository path.'
      );
    }
  };

  async function connectProjectPath(path: string) {
    const project = await addProjectMutation.mutateAsync({ path });
    workspaceSession.requestProjectSelection(project.id);
    setManualRepositoryPath('');
  }

  function resetProjectActionState() {
    setProjectActionError(null);
    addProjectMutation.reset();
  }

  return (
    <div className="flex h-full min-h-0 w-full overflow-hidden bg-surface-0 text-text-primary outline-none ring-0">
      {isSidebarOpen ? (
        <WorkspaceSidebar
          createErrorMessage={formatErrorMessage(workspaceSession.createTaskMutation.error) ?? taskLoadError}
          isAddingProject={addProjectMutation.isPending}
          isCreatingTask={workspaceSession.createTaskMutation.isPending}
          isDeletingTask={workspaceSession.deleteTaskMutation.isPending}
          isLoadingProjects={projectsQuery.isLoading}
          isLoadingTasks={workspaceSession.taskWorkspacesQuery.isLoading}
          manualPath={manualRepositoryPath}
          project={workspaceSession.selectedProject}
          projectErrorMessage={
            projectActionError ??
            formatErrorMessage(addProjectMutation.error) ??
            projectLoadError
          }
          projects={projects}
          selectedProjectId={workspaceSession.selectedProjectId}
          selectedTaskId={workspaceSession.selectedTaskId}
          taskWorkspaces={workspaceSession.taskWorkspaces}
          onAddRepository={handleAddRepository}
          onCreateTask={workspaceSession.createTaskWorkspace}
          onManualPathChange={setManualRepositoryPath}
          onDeleteTask={workspaceSession.requestTaskDeletion}
          onSelectProject={workspaceSession.requestProjectSelection}
          onSelectTask={workspaceSession.requestTaskSelection}
          onSubmitManualPath={handleManualRepositoryAdd}
          onToggleSidebar={() => setIsSidebarOpen(false)}
        />
      ) : (
        <div className="drag-region absolute left-0 top-0 z-10 flex h-[38px] items-center pl-[68px] pr-2">
          <button
            className="no-drag grid h-7 w-7 place-items-center rounded-control text-text-faint transition hover:bg-white/[0.08] hover:text-text-secondary"
            onClick={() => setIsSidebarOpen(true)}
            title="Show sidebar"
            type="button"
          >
            <PanelLeft className="h-4 w-4" />
          </button>
        </div>
      )}

      <main className="flex min-w-0 flex-1 flex-col">
        <WorkspaceDetails
          ref={editorRef}
          isForkingTask={workspaceSession.createTaskMutation.isPending}
          isLoadingTasks={workspaceSession.taskWorkspacesQuery.isLoading}
          onForkTaskWorkspace={workspaceSession.forkSelectedTaskWorkspace}
          onRequestTaskSelection={workspaceSession.requestTaskSelection}
          project={workspaceSession.selectedProject}
          taskWorkspace={workspaceSession.selectedTaskWorkspace}
        />
      </main>

      <UnsavedChangesDialog
        {...workspaceSession.contextSwitchDialogProps}
        title="Unsaved workspace edits"
      />
    </div>
  );
}

function formatErrorMessage(error: unknown): string | null {
  return error instanceof Error ? error.message : null;
}
