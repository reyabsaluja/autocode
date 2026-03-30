import { useEffect, useState } from 'react';

import { useAddProjectMutation, useProjectsQuery } from '../features/projects/project-hooks';
import { useCreateTaskWorkspaceMutation, useTaskWorkspacesQuery } from '../features/tasks/task-hooks';
import { WorkspaceDetails } from '../features/tasks/workspace-details';
import { autocodeApi } from '../lib/autocode-api';
import { useWorkspaceStore } from '../stores/workspace-store';
import { WorkspaceSidebar } from '../features/workspace/workspace-sidebar';

export function App() {
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
    selectTask(workspace.task.id);
  };

  async function connectProjectPath(path: string) {
    const project = await addProjectMutation.mutateAsync({ path });
    selectProject(project.id);
    selectTask(null);
    setManualRepositoryPath('');
  }

  function resetProjectActionState() {
    setProjectActionError(null);
    addProjectMutation.reset();
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
          onSelectProject={selectProject}
          onSelectTask={selectTask}
          onSubmitManualPath={handleManualRepositoryAdd}
        />

        <main className="min-w-0 flex-1 p-3">
          <WorkspaceDetails
            isLoadingTasks={taskWorkspacesQuery.isLoading}
            project={selectedProject}
            taskWorkspace={selectedTaskWorkspace}
          />
        </main>
      </div>
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
