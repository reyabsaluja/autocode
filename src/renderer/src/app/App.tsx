import { useEffect } from 'react';

import { ProjectDetails } from '../features/projects/project-details';
import { useAddProjectMutation, useProjectsQuery } from '../features/projects/project-hooks';
import { ProjectSidebar } from '../features/projects/project-sidebar';
import { autocodeApi } from '../lib/autocode-api';
import { useWorkspaceStore } from '../stores/workspace-store';

export function App() {
  const projectsQuery = useProjectsQuery();
  const addProjectMutation = useAddProjectMutation();
  const selectedProjectId = useWorkspaceStore((state) => state.selectedProjectId);
  const selectProject = useWorkspaceStore((state) => state.selectProject);

  const projects = projectsQuery.data ?? [];
  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null;

  useEffect(() => {
    if (projects.length === 0) {
      if (selectedProjectId !== null) {
        selectProject(null);
      }

      return;
    }

    const selectedStillExists = projects.some((project) => project.id === selectedProjectId);

    if (!selectedStillExists) {
      selectProject(projects[0]?.id ?? null);
    }
  }, [projects, selectedProjectId, selectProject]);

  const handleAddRepository = async () => {
    const selectedPath = await autocodeApi.projects.pickPath();

    if (!selectedPath) {
      return;
    }

    const project = await addProjectMutation.mutateAsync({ path: selectedPath });
    selectProject(project.id);
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(15,118,110,0.16),_transparent_26%),linear-gradient(180deg,_#f7f4ee_0%,_#efe5d3_100%)] text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-[1600px] gap-6 px-6 py-6">
        <ProjectSidebar
          projects={projects}
          isLoading={projectsQuery.isLoading}
          isAddingProject={addProjectMutation.isPending}
          errorMessage={addProjectMutation.error?.message ?? null}
          selectedProjectId={selectedProjectId}
          onAddRepository={handleAddRepository}
          onSelectProject={selectProject}
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
                  resumable agent sessions. This first slice keeps the loop grounded in real local
                  repositories instead of mock data.
                </p>
              </div>

              <div className="grid gap-3 rounded-3xl border border-slate-200/80 bg-slate-950 px-5 py-4 text-slate-100 sm:grid-cols-3">
                <StatCard
                  label="Projects"
                  value={projects.length.toString().padStart(2, '0')}
                />
                <StatCard
                  label="Tasks"
                  value="00"
                />
                <StatCard
                  label="Agents"
                  value="00"
                />
              </div>
            </div>
          </section>

          <ProjectDetails
            project={selectedProject}
            isLoading={projectsQuery.isLoading}
          />
        </main>
      </div>
    </div>
  );
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

