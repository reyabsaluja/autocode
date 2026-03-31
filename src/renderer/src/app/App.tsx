import { useCallback, useEffect, useRef, useState } from 'react';
import { PanelLeft } from 'lucide-react';

import type { WorkspaceEditorHandle } from '../features/editor/workspace-editor-surface';
import { UnsavedChangesDialog } from '../features/editor/unsaved-changes-dialog';
import { useUnsavedChangesGuard } from '../features/editor/use-unsaved-changes-guard';
import { useAddProjectMutation, useProjectsQuery } from '../features/projects/project-hooks';
import { useCreateTaskWorkspaceMutation, useTaskWorkspacesQuery } from '../features/tasks/task-hooks';
import { WorkspaceDetails } from '../features/tasks/workspace-details';
import { autocodeApi } from '../lib/autocode-api';
import { useWorkspaceStore } from '../stores/workspace-store';
import { WorkspaceSidebar } from '../features/workspace/workspace-sidebar';

export function App() {
  const editorRef = useRef<WorkspaceEditorHandle | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const projectsQuery = useProjectsQuery();
  const addProjectMutation = useAddProjectMutation();
  const [projectActionError, setProjectActionError] = useState<string | null>(null);
  const [manualRepositoryPath, setManualRepositoryPath] = useState('');
  const selectedTaskId = useWorkspaceStore((state) => state.selectedTaskId);
  const selectedProjectId = useWorkspaceStore((state) => state.selectedProjectId);
  const selectProject = useWorkspaceStore((state) => state.selectProject);
  const selectTask = useWorkspaceStore((state) => state.selectTask);

  const projects = projectsQuery.data ?? [];
  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null;
  const effectiveProjectId = selectedProject?.id ?? null;
  const taskWorkspacesQuery = useTaskWorkspacesQuery(effectiveProjectId);
  const createTaskMutation = useCreateTaskWorkspaceMutation(effectiveProjectId);
  const taskWorkspaces = taskWorkspacesQuery.data ?? [];
  const selectedTaskWorkspace =
    taskWorkspaces.find((workspace) => workspace.task.id === selectedTaskId) ?? null;
  const projectLoadError = formatErrorMessage(projectsQuery.error);
  const taskLoadError = formatErrorMessage(taskWorkspacesQuery.error);
  const { dialogProps: contextSwitchDialogProps, requestTransition: requestContextTransition } =
    useUnsavedChangesGuard(editorRef);

  const requestProjectSelection = useCallback(
    (projectId: number | null) => {
      if (projectId === selectedProjectId) {
        return;
      }

      requestContextTransition({
        body: `Save or discard your changes to ${
          editorRef.current?.getActiveFilePath() ?? 'the current file'
        } before leaving this workspace.`,
        key: `project:${projectId ?? 'none'}`,
        run: () => {
          selectProject(projectId);
        }
      });
    },
    [requestContextTransition, selectProject, selectedProjectId]
  );

  const requestTaskSelection = useCallback(
    (taskId: number | null) => {
      if (taskId === selectedTaskId) {
        return;
      }

      requestContextTransition({
        body: `Save or discard your changes to ${
          editorRef.current?.getActiveFilePath() ?? 'the current file'
        } before leaving this workspace.`,
        key: `task:${taskId ?? 'none'}`,
        run: () => {
          selectTask(taskId);
        }
      });
    },
    [requestContextTransition, selectTask, selectedTaskId]
  );

  useEffect(() => {
    if (projects.length === 0) {
      if (selectedProjectId !== null) {
        requestProjectSelection(null);
        return;
      }

      if (selectedTaskId !== null) {
        requestTaskSelection(null);
      }

      return;
    }

    const selectedStillExists = projects.some((project) => project.id === selectedProjectId);

    if (!selectedStillExists) {
      requestProjectSelection(projects[0]?.id ?? null);
    }
  }, [
    projects,
    requestProjectSelection,
    requestTaskSelection,
    selectedProjectId,
    selectedTaskId
  ]);

  useEffect(() => {
    createTaskMutation.reset();
  }, [createTaskMutation, effectiveProjectId]);

  useEffect(() => {
    if (selectedProjectId !== null && effectiveProjectId === null) {
      return;
    }

    if (effectiveProjectId === null) {
      if (selectedTaskId !== null) {
        requestTaskSelection(null);
      }

      return;
    }

    if (taskWorkspacesQuery.isLoading) {
      return;
    }

    if (taskWorkspaces.length === 0) {
      if (selectedTaskId !== null) {
        requestTaskSelection(null);
      }

      return;
    }

    const selectedStillExists = taskWorkspaces.some((workspace) => workspace.task.id === selectedTaskId);

    if (!selectedStillExists) {
      requestTaskSelection(taskWorkspaces[0]?.task.id ?? null);
    }
  }, [
    effectiveProjectId,
    requestTaskSelection,
    selectedProjectId,
    selectedTaskId,
    taskWorkspaces,
    taskWorkspacesQuery.isLoading
  ]);

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

  const handleCreateTask = async (input: { description: string; title: string }) => {
    const workspace = await createTaskMutation.mutateAsync(input);
    requestTaskSelection(workspace.task.id);
  };

  async function connectProjectPath(path: string) {
    const project = await addProjectMutation.mutateAsync({ path });
    requestProjectSelection(project.id);
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
          createErrorMessage={formatErrorMessage(createTaskMutation.error) ?? taskLoadError}
          isAddingProject={addProjectMutation.isPending}
          isCreatingTask={createTaskMutation.isPending}
          isLoadingProjects={projectsQuery.isLoading}
          isLoadingTasks={taskWorkspacesQuery.isLoading}
          manualPath={manualRepositoryPath}
          project={selectedProject}
          projectErrorMessage={
            projectActionError ??
            formatErrorMessage(addProjectMutation.error) ??
            projectLoadError
          }
          projects={projects}
          selectedProjectId={selectedProjectId}
          selectedTaskId={selectedTaskId}
          taskWorkspaces={taskWorkspaces}
          onAddRepository={handleAddRepository}
          onCreateTask={handleCreateTask}
          onManualPathChange={setManualRepositoryPath}
          onSelectProject={requestProjectSelection}
          onSelectTask={requestTaskSelection}
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
          isLoadingTasks={taskWorkspacesQuery.isLoading}
          project={selectedProject}
          taskWorkspace={selectedTaskWorkspace}
        />
      </main>

      <UnsavedChangesDialog
        {...contextSwitchDialogProps}
        title="Unsaved workspace edits"
      />
    </div>
  );
}

function formatErrorMessage(error: unknown): string | null {
  return error instanceof Error ? error.message : null;
}
