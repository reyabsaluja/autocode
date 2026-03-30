import { useEffect, useRef, useState } from 'react';

import type { WorkspaceEditorHandle } from '../features/editor/workspace-editor-surface';
import { UnsavedChangesDialog } from '../features/editor/unsaved-changes-dialog';
import { useAddProjectMutation, useProjectsQuery } from '../features/projects/project-hooks';
import { useCreateTaskWorkspaceMutation, useTaskWorkspacesQuery } from '../features/tasks/task-hooks';
import { WorkspaceDetails } from '../features/tasks/workspace-details';
import { autocodeApi } from '../lib/autocode-api';
import { useWorkspaceStore } from '../stores/workspace-store';
import { WorkspaceSidebar } from '../features/workspace/workspace-sidebar';

export function App() {
  const editorRef = useRef<WorkspaceEditorHandle | null>(null);
  const projectsQuery = useProjectsQuery();
  const addProjectMutation = useAddProjectMutation();
  const [isResolvingContextSwitch, setIsResolvingContextSwitch] = useState(false);
  const [pendingContextSwitch, setPendingContextSwitch] = useState<
    | { projectId: number | null; type: 'project' }
    | { taskId: number | null; type: 'task' }
    | null
  >(null);
  const [projectActionError, setProjectActionError] = useState<string | null>(null);
  const [manualRepositoryPath, setManualRepositoryPath] = useState('');
  const selectedTaskId = useWorkspaceStore((state) => state.selectedTaskId);
  const selectedProjectId = useWorkspaceStore((state) => state.selectedProjectId);
  const selectProject = useWorkspaceStore((state) => state.selectProject);
  const selectTask = useWorkspaceStore((state) => state.selectTask);

  const projects = projectsQuery.data ?? [];
  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null;
  const taskWorkspacesQuery = useTaskWorkspacesQuery(selectedProjectId);
  const createTaskMutation = useCreateTaskWorkspaceMutation(selectedProjectId);
  const taskWorkspaces = taskWorkspacesQuery.data ?? [];
  const selectedTaskWorkspace =
    taskWorkspaces.find((workspace) => workspace.task.id === selectedTaskId) ?? null;
  const projectLoadError = formatErrorMessage(projectsQuery.error);
  const taskLoadError = formatErrorMessage(taskWorkspacesQuery.error);

  useEffect(() => {
    if (projects.length === 0) {
      if (selectedProjectId !== null) {
        selectProject(null);
      }

      if (selectedTaskId !== null) {
        selectTask(null);
      }

      return;
    }

    const selectedStillExists = projects.some((project) => project.id === selectedProjectId);

    if (!selectedStillExists) {
      selectProject(projects[0]?.id ?? null);
    }
  }, [projects, selectedProjectId, selectedTaskId, selectProject, selectTask]);

  useEffect(() => {
    createTaskMutation.reset();
  }, [selectedProjectId]);

  useEffect(() => {
    if (selectedProjectId === null) {
      if (selectedTaskId !== null) {
        selectTask(null);
      }

      return;
    }

    if (taskWorkspacesQuery.isLoading) {
      return;
    }

    if (taskWorkspaces.length === 0) {
      if (selectedTaskId !== null) {
        selectTask(null);
      }

      return;
    }

    const selectedStillExists = taskWorkspaces.some((workspace) => workspace.task.id === selectedTaskId);

    if (!selectedStillExists) {
      selectTask(taskWorkspaces[0]?.task.id ?? null);
    }
  }, [
    selectedProjectId,
    selectedTaskId,
    selectTask,
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

  function requestProjectSelection(projectId: number | null) {
    if (projectId === selectedProjectId) {
      return;
    }

    if (editorRef.current?.hasUnsavedChanges()) {
      setPendingContextSwitch({
        projectId,
        type: 'project'
      });
      return;
    }

    selectProject(projectId);
  }

  function requestTaskSelection(taskId: number | null) {
    if (taskId === selectedTaskId) {
      return;
    }

    if (editorRef.current?.hasUnsavedChanges()) {
      setPendingContextSwitch({
        taskId,
        type: 'task'
      });
      return;
    }

    selectTask(taskId);
  }

  function applyPendingContextSwitch() {
    if (!pendingContextSwitch) {
      return;
    }

    if (pendingContextSwitch.type === 'project') {
      selectProject(pendingContextSwitch.projectId);
    } else {
      selectTask(pendingContextSwitch.taskId);
    }

    setPendingContextSwitch(null);
  }

  async function handlePendingContextSave() {
    setIsResolvingContextSwitch(true);
    const didSave = (await editorRef.current?.saveActiveFile()) ?? false;
    setIsResolvingContextSwitch(false);

    if (!didSave) {
      return;
    }

    applyPendingContextSwitch();
  }

  function handlePendingContextDiscard() {
    editorRef.current?.discardUnsavedChanges();
    applyPendingContextSwitch();
  }

  return (
    <div className="min-h-screen bg-[#08090b] text-slate-100">
      <div className="flex min-h-screen">
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
        />

        <main className="min-w-0 flex-1 p-3">
          <WorkspaceDetails
            ref={editorRef}
            isLoadingTasks={taskWorkspacesQuery.isLoading}
            project={selectedProject}
            taskWorkspace={selectedTaskWorkspace}
          />
        </main>
      </div>

      <UnsavedChangesDialog
        body={`Save or discard your changes to ${editorRef.current?.getActiveFilePath() ?? 'the current file'} before leaving this workspace.`}
        isOpen={pendingContextSwitch !== null}
        isSaving={isResolvingContextSwitch}
        onCancel={() => {
          setPendingContextSwitch(null);
        }}
        onDiscard={handlePendingContextDiscard}
        onSave={() => {
          void handlePendingContextSave();
        }}
        title="Unsaved workspace edits"
      />
    </div>
  );
}

function formatErrorMessage(error: unknown): string | null {
  return error instanceof Error ? error.message : null;
}

interface StatCardProps {
  label: string;
  value: string;
}
