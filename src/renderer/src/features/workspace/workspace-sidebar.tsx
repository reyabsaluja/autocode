import { useState } from 'react';
import clsx from 'clsx';
import {
  ChevronDown,
  ChevronRight,
  FolderGit2,
  GitBranch,
  History,
  Loader2,
  PanelLeft,
  Plus
} from 'lucide-react';

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
  const [isReposExpanded, setIsReposExpanded] = useState(false);

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
    <aside className="flex h-full w-[280px] shrink-0 flex-col border-r border-border bg-surface-1 animate-slide-in-left">
      <div className="drag-region flex h-[38px] shrink-0 items-center justify-between border-b border-border px-2">
        <div className="flex items-center pl-[68px]">
          <button
            className="no-drag grid h-7 w-7 place-items-center rounded-control text-text-faint transition hover:bg-white/[0.06] hover:text-text-secondary"
            title="Toggle sidebar"
            type="button"
          >
            <PanelLeft className="h-4 w-4" />
          </button>
        </div>
        <button
          className="no-drag grid h-7 w-7 place-items-center rounded-control text-text-faint transition hover:bg-white/[0.06] hover:text-text-secondary"
          title="History"
          type="button"
        >
          <History className="h-4 w-4" />
        </button>
      </div>

      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted">
            Workspaces
          </span>
          <button
            className={clsx(
              'flex items-center gap-1 rounded-control px-2 py-1 text-[11px] font-medium transition',
              'text-text-muted hover:bg-white/[0.06] hover:text-text-secondary'
            )}
            onClick={() => setIsComposerOpen((current) => !current)}
            type="button"
          >
            <Plus className="h-3 w-3" />
            New
          </button>
        </div>
        {project ? (
          <p className="mt-1 truncate text-[13px] font-medium text-text-primary">
            {project.name}
          </p>
        ) : (
          <p className="mt-1 text-[13px] text-text-faint">No repository selected</p>
        )}
      </div>

      {isComposerOpen ? (
        <div className="animate-slide-up border-b border-border px-3 py-3">
          <div className="space-y-2 rounded-card border border-border bg-surface-0 p-3">
            <input
              className={clsx(
                'w-full rounded-control border border-border bg-surface-0 px-3 py-1.5 text-[13px] text-text-primary outline-none transition',
                'placeholder:text-text-faint focus:border-accent-muted focus:ring-1 focus:ring-accent-dim'
              )}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Workspace title"
              value={title}
            />
            <textarea
              className={clsx(
                'min-h-[64px] w-full resize-none rounded-control border border-border bg-surface-0 px-3 py-1.5 text-[13px] text-text-primary outline-none transition',
                'placeholder:text-text-faint focus:border-accent-muted focus:ring-1 focus:ring-accent-dim'
              )}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Optional notes"
              value={description}
            />
            <button
              className={clsx(
                'flex w-full items-center justify-center rounded-control bg-accent px-3 py-1.5 text-[13px] font-semibold text-surface-0 transition',
                'hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50'
              )}
              disabled={!project || isCreatingTask || title.trim().length === 0}
              onClick={() => { void handleCreateTask(); }}
              type="button"
            >
              {isCreatingTask ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : null}
              {isCreatingTask ? 'Creating...' : 'Create workspace'}
            </button>
            {createErrorMessage ? (
              <p className="text-[12px] text-rose-400">{createErrorMessage}</p>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="border-b border-border px-3 py-2">
        <button
          className="flex w-full items-center gap-1.5 rounded-control px-1 py-1 text-left transition hover:bg-white/[0.04]"
          onClick={() => setIsReposExpanded((c) => !c)}
          type="button"
        >
          {isReposExpanded ? (
            <ChevronDown className="h-3 w-3 text-text-faint" />
          ) : (
            <ChevronRight className="h-3 w-3 text-text-faint" />
          )}
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted">
            Repositories
          </span>
          <span className="ml-auto rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10px] tabular-nums text-text-faint">
            {projects.length}
          </span>
        </button>

        {isReposExpanded ? (
          <div className="mt-1 space-y-0.5 animate-fade-in">
            {isLoadingProjects ? (
              <SidebarMessage>Loading repositories...</SidebarMessage>
            ) : null}

            {projects.map((entry) => {
              const isSelected = entry.id === selectedProjectId;

              return (
                <button
                  key={entry.id}
                  className={clsx(
                    'flex w-full items-center gap-2 rounded-control px-2 py-1.5 text-left transition',
                    isSelected
                      ? 'bg-accent-dim text-accent'
                      : 'text-text-secondary hover:bg-white/[0.04] hover:text-text-primary'
                  )}
                  onClick={() => onSelectProject(entry.id)}
                  type="button"
                >
                  <FolderGit2 className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate text-[13px] font-medium">{entry.name}</span>
                </button>
              );
            })}

            <div className="mt-2 space-y-2 rounded-card border border-dashed border-border p-2">
              <button
                className={clsx(
                  'flex w-full items-center justify-center gap-1.5 rounded-control border border-border bg-white/[0.03] px-2 py-1.5 text-[12px] font-medium text-text-secondary transition',
                  'hover:bg-white/[0.06] hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50'
                )}
                disabled={isAddingProject}
                onClick={() => { void onAddRepository(); }}
                type="button"
              >
                <Plus className="h-3 w-3" />
                {isAddingProject ? 'Adding...' : 'Add repository'}
              </button>
              <input
                className={clsx(
                  'w-full rounded-control border border-border bg-surface-0 px-2 py-1.5 text-[12px] text-text-primary outline-none transition',
                  'placeholder:text-text-faint focus:border-accent-muted focus:ring-1 focus:ring-accent-dim'
                )}
                onChange={(event) => onManualPathChange(event.target.value)}
                placeholder="~/Code/my-repo"
                value={manualPath}
              />
              <button
                className={clsx(
                  'w-full rounded-control border border-border bg-white/[0.03] px-2 py-1.5 text-[12px] font-medium text-text-secondary transition',
                  'hover:bg-white/[0.06] hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50'
                )}
                disabled={isAddingProject || manualPath.trim().length === 0}
                onClick={() => { void onSubmitManualPath(); }}
                type="button"
              >
                Use path
              </button>
              {projectErrorMessage ? (
                <p className="text-[12px] text-rose-400">{projectErrorMessage}</p>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-3 py-2">
        <div className="mb-1 flex items-center justify-between px-1">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted">
            Tasks
          </span>
          <span className="rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10px] tabular-nums text-text-faint">
            {taskWorkspaces.length}
          </span>
        </div>

        <div className="min-h-0 flex-1 space-y-0.5 overflow-auto">
          {!project ? (
            <SidebarMessage>Select a repository first.</SidebarMessage>
          ) : null}

          {isLoadingTasks ? (
            <SidebarMessage>
              <Loader2 className="mr-1.5 inline h-3 w-3 animate-spin" />
              Loading workspaces...
            </SidebarMessage>
          ) : null}

          {project && !isLoadingTasks && taskWorkspaces.length === 0 ? (
            <SidebarMessage>No workspaces yet.</SidebarMessage>
          ) : null}

          {!isLoadingTasks
            ? taskWorkspaces.map((workspace) => {
                const isSelected = workspace.task.id === selectedTaskId;

                return (
                  <button
                    key={workspace.task.id}
                    className={clsx(
                      'group w-full rounded-card px-2.5 py-2 text-left transition',
                      isSelected
                        ? 'bg-white/[0.07] shadow-sm'
                        : 'hover:bg-white/[0.04]'
                    )}
                    onClick={() => onSelectTask(workspace.task.id)}
                    type="button"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className={clsx(
                        'truncate text-[13px] font-medium',
                        isSelected ? 'text-text-primary' : 'text-text-secondary group-hover:text-text-primary'
                      )}>
                        {workspace.task.title}
                      </p>
                      <StatusDot status={workspace.task.status} />
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-text-faint">
                      <GitBranch className="h-3 w-3" />
                      <span className="truncate font-mono">
                        {workspace.worktree?.branchName ?? 'pending'}
                      </span>
                      <span className="ml-auto shrink-0">{formatShortDate(workspace.task.updatedAt)}</span>
                    </div>
                  </button>
                );
              })
            : null}
        </div>
      </div>
    </aside>
  );
}

function StatusDot({ status }: { status: TaskWorkspace['task']['status'] }) {
  const colors: Record<TaskWorkspace['task']['status'], string> = {
    archived: 'bg-zinc-500',
    completed: 'bg-emerald-400',
    draft: 'bg-amber-400',
    failed: 'bg-rose-400',
    in_progress: 'bg-sky-400',
    needs_review: 'bg-violet-400',
    ready: 'bg-accent'
  };

  return (
    <span
      className={clsx('h-1.5 w-1.5 shrink-0 rounded-full', colors[status])}
      title={status.replace('_', ' ')}
    />
  );
}

function SidebarMessage({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-1 py-2 text-[12px] text-text-faint">{children}</p>
  );
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric'
  }).format(new Date(value));
}
