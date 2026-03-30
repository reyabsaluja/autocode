import { useEffect, useState } from 'react';

import { useAddProjectMutation, useProjectsQuery } from '../features/projects/project-hooks';
import { ProjectSidebar } from '../features/projects/project-sidebar';
import { useCreateTaskWorkspaceMutation, useTaskWorkspacesQuery } from '../features/tasks/task-hooks';
import { TaskSidebar } from '../features/tasks/task-sidebar';
import { WorkspaceDetails } from '../features/tasks/workspace-details';
import { autocodeApi } from '../lib/autocode-api';
import { useWorkspaceStore } from '../stores/workspace-store';

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
    setProjectActionError(null);
    addProjectMutation.reset();

    try {
      const selectedPath = await autocodeApi.projects.pickPath();

      if (!selectedPath) {
        return;
      }

      const project = await addProjectMutation.mutateAsync({ path: selectedPath });
      selectProject(project.id);
      selectTask(null);
      setManualRepositoryPath('');
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

    setProjectActionError(null);
    addProjectMutation.reset();

    try {
      const project = await addProjectMutation.mutateAsync({ path });
      selectProject(project.id);
      selectTask(null);
      setManualRepositoryPath('');
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

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(15,118,110,0.16),_transparent_26%),linear-gradient(180deg,_#f7f4ee_0%,_#efe5d3_100%)] text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-[1760px] gap-6 px-6 py-6">
        <ProjectSidebar
          projects={projects}
          isLoading={projectsQuery.isLoading}
          isAddingProject={addProjectMutation.isPending}
          errorMessage={
            projectActionError ??
            formatErrorMessage(addProjectMutation.error) ??
            projectLoadError
          }
          manualPath={manualRepositoryPath}
          selectedProjectId={selectedProjectId}
          onAddRepository={handleAddRepository}
          onManualPathChange={setManualRepositoryPath}
          onSubmitManualPath={handleManualRepositoryAdd}
          onSelectProject={selectProject}
        />

        <TaskSidebar
          createErrorMessage={formatErrorMessage(createTaskMutation.error) ?? taskLoadError}
          isCreatingTask={createTaskMutation.isPending}
          isLoading={taskWorkspacesQuery.isLoading}
          project={selectedProject}
          selectedTaskId={selectedTaskId}
          tasks={taskWorkspaces}
          onCreateTask={handleCreateTask}
          onSelectTask={selectTask}
        />

        <main className="flex min-w-0 flex-1 flex-col gap-6">
          <section className="rounded-[32px] border border-white/60 bg-white/70 p-8 shadow-panel backdrop-blur">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <p className="text-sm font-semibold uppercase tracking-[0.28em] text-accent">
                  AI Agent IDE
                </p>
                <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">
                  Coordinate coding agents without losing the plot.
                </h1>
                <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
                  Autocode is the control plane for repo-aware tasks, isolated worktrees, and
                  resumable agent sessions. Tasks now behave like durable workspaces you can reopen
                  instantly instead of one-off actions.
                </p>
              </div>

              <div className="grid gap-3 rounded-3xl border border-slate-200/80 bg-slate-950 px-5 py-4 text-slate-100 sm:grid-cols-3">
                <StatCard
                  label="Projects"
                  value={projects.length.toString().padStart(2, '0')}
                />
                <StatCard
                  label="Tasks"
                  value={taskWorkspaces.length.toString().padStart(2, '0')}
                />
                <StatCard
                  label="Workspace"
                  value={selectedTaskWorkspace ? 'OPEN' : 'IDLE'}
                />
              </div>
            </div>
          </section>

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

function StatCard({ label, value }: StatCardProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
      <p className="text-xs uppercase tracking-[0.22em] text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}
