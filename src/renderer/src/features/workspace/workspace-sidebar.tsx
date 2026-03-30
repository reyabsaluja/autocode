import { useState } from 'react';

import type { Project } from '@shared/domain/project';
import type { TaskWorkspace } from '@shared/domain/task-workspace';

interface WorkspaceSidebarProps {
  createErrorMessage: string | null;
  isAddingProject: boolean;
  isCreatingTask: boolean;
  isLoadingProjects: boolean;
  isLoadingTasks: boolean;
  manualPath: string;
  project: Project | null;
  projectErrorMessage: string | null;
  projects: Project[];
  selectedProjectId: number | null;
  selectedTaskId: number | null;
  taskWorkspaces: TaskWorkspace[];
  onAddRepository: () => Promise<void>;
  onCreateTask: (input: { description: string; title: string }) => Promise<void>;
  onManualPathChange: (value: string) => void;
  onSelectProject: (projectId: number | null) => void;
  onSelectTask: (taskId: number | null) => void;
  onSubmitManualPath: () => Promise<void>;
}

export function WorkspaceSidebar({
  createErrorMessage,
  isAddingProject,
  isCreatingTask,
  isLoadingProjects,
  isLoadingTasks,
  manualPath,
  project,
  projectErrorMessage,
  projects,
  selectedProjectId,
  selectedTaskId,
  taskWorkspaces,
  onAddRepository,
  onCreateTask,
  onManualPathChange,
  onSelectProject,
  onSelectTask,
  onSubmitManualPath
}: WorkspaceSidebarProps) {
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const handleCreateTask = async () => {
    await onCreateTask({
      description,
      title
    });

    setTitle('');
    setDescription('');
    setIsComposerOpen(false);
  };

  return (
    <div className="flex min-h-screen w-[392px] shrink-0 border-r border-white/6 bg-[#0f1012] text-slate-100">
      <aside className="flex w-[64px] shrink-0 flex-col items-center border-r border-white/6 bg-[#0a0b0d] px-3 py-4">
        <div className="grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] font-mono text-sm font-semibold text-white">
          A
        </div>
        <div className="mt-6 flex flex-col gap-3">
          <button
            className="grid h-10 w-10 place-items-center rounded-2xl border border-teal-400/20 bg-teal-400/10 text-teal-200 transition hover:border-teal-300/30 hover:bg-teal-400/14"
            type="button"
          >
            ▦
          </button>
          <button
            className="grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-white/[0.03] text-slate-400 transition hover:bg-white/[0.06] hover:text-slate-200"
            onClick={() => {
              void onAddRepository();
            }}
            title="Add repository"
            type="button"
          >
            ＋
          </button>
        </div>
      </aside>

      <aside className="flex min-w-0 flex-1 flex-col">
        <div className="border-b border-white/6 px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Workspaces</p>
              <p className="mt-2 truncate text-sm text-slate-300">
                {project ? project.name : 'No repository selected'}
              </p>
            </div>
            <button
              className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-white/[0.08]"
              onClick={() => setIsComposerOpen((current) => !current)}
              type="button"
            >
              New
            </button>
          </div>

          {isComposerOpen ? (
            <div className="mt-4 space-y-3 rounded-2xl border border-white/8 bg-white/[0.03] p-3">
              <input
                className="w-full rounded-xl border border-white/10 bg-[#0a0b0d] px-3 py-2 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-teal-400/40 focus:ring-2 focus:ring-teal-400/10"
                onChange={(event) => setTitle(event.target.value)}
                placeholder="New workspace title"
                value={title}
              />
              <textarea
                className="min-h-[84px] w-full rounded-xl border border-white/10 bg-[#0a0b0d] px-3 py-2 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-teal-400/40 focus:ring-2 focus:ring-teal-400/10"
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Optional notes"
                value={description}
              />
              <button
                className="inline-flex w-full items-center justify-center rounded-xl bg-white px-3 py-2 text-sm font-semibold text-black transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!project || isCreatingTask || title.trim().length === 0}
                onClick={() => {
                  void handleCreateTask();
                }}
                type="button"
              >
                {isCreatingTask ? 'Creating...' : 'Create workspace'}
              </button>
              {createErrorMessage ? (
                <p className="text-sm text-rose-300">{createErrorMessage}</p>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="border-b border-white/6 px-5 py-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Repos</span>
            <span className="text-xs text-slate-500">{projects.length}</span>
          </div>

          <div className="space-y-2">
            {isLoadingProjects ? (
              <p className="text-sm text-slate-500">Loading repositories...</p>
            ) : null}

            {projects.map((entry) => {
              const isSelected = entry.id === selectedProjectId;

              return (
                <button
                  key={entry.id}
                  className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                    isSelected
                      ? 'border-teal-400/20 bg-teal-400/10'
                      : 'border-white/8 bg-white/[0.02] hover:bg-white/[0.05]'
                  }`}
                  onClick={() => onSelectProject(entry.id)}
                  type="button"
                >
                  <p className="truncate text-sm font-medium text-white">{entry.name}</p>
                  <p className="mt-1 truncate text-xs text-slate-500">{entry.repoPath}</p>
                </button>
              );
            })}

            <div className="rounded-2xl border border-dashed border-white/8 bg-white/[0.02] p-3">
              <button
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isAddingProject}
                onClick={() => {
                  void onAddRepository();
                }}
                type="button"
              >
                {isAddingProject ? 'Adding repository...' : 'Add repository'}
              </button>
              <input
                className="mt-3 w-full rounded-xl border border-white/10 bg-[#0a0b0d] px-3 py-2 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-teal-400/40 focus:ring-2 focus:ring-teal-400/10"
                onChange={(event) => onManualPathChange(event.target.value)}
                placeholder="/Users/reyab/Code/repo"
                value={manualPath}
              />
              <button
                className="mt-3 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isAddingProject || manualPath.trim().length === 0}
                onClick={() => {
                  void onSubmitManualPath();
                }}
                type="button"
              >
                Use path
              </button>
              {projectErrorMessage ? (
                <p className="mt-3 text-sm text-rose-300">{projectErrorMessage}</p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 px-3 py-4">
          <div className="mb-3 flex items-center justify-between px-2">
            <span className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Task workspaces</span>
            <span className="text-xs text-slate-500">{taskWorkspaces.length}</span>
          </div>

          <div className="min-h-0 space-y-2 overflow-auto">
            {!project ? (
              <p className="px-2 text-sm text-slate-500">Select a repository to open its workspaces.</p>
            ) : null}

            {isLoadingTasks ? (
              <p className="px-2 text-sm text-slate-500">Loading workspaces...</p>
            ) : null}

            {project && !isLoadingTasks && taskWorkspaces.length === 0 ? (
              <p className="px-2 text-sm text-slate-500">No workspaces yet for this repository.</p>
            ) : null}

            {!isLoadingTasks
              ? taskWorkspaces.map((workspace) => {
                  const isSelected = workspace.task.id === selectedTaskId;

                  return (
                    <button
                      key={workspace.task.id}
                      className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                        isSelected
                          ? 'border-white/10 bg-white/[0.09]'
                          : 'border-transparent bg-transparent hover:border-white/8 hover:bg-white/[0.04]'
                      }`}
                      onClick={() => onSelectTask(workspace.task.id)}
                      type="button"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate text-sm font-medium text-white">
                          {workspace.task.title}
                        </p>
                        <StatusPill status={workspace.task.status} />
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                        <span className="truncate">{workspace.worktree?.branchName ?? 'pending'}</span>
                        <span>{formatShortDate(workspace.task.updatedAt)}</span>
                      </div>
                    </button>
                  );
                })
              : null}
          </div>
        </div>
      </aside>
    </div>
  );
}

function StatusPill({ status }: { status: TaskWorkspace['task']['status'] }) {
  const styles: Record<TaskWorkspace['task']['status'], string> = {
    archived: 'bg-slate-700 text-slate-200',
    completed: 'bg-emerald-500/20 text-emerald-200',
    draft: 'bg-amber-500/20 text-amber-200',
    failed: 'bg-rose-500/20 text-rose-200',
    in_progress: 'bg-sky-500/20 text-sky-200',
    needs_review: 'bg-violet-500/20 text-violet-200',
    ready: 'bg-teal-500/20 text-teal-200'
  };

  return (
    <span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${styles[status]}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric'
  }).format(new Date(value));
}
