import { useState } from 'react';
import clsx from 'clsx';
import {
  ChevronDown,
  ChevronRight,
  FolderGit2,
  GitBranch,
  History,
  Layers,
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
  onToggleSidebar: () => void;
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
  onSubmitManualPath,
  onToggleSidebar
}: WorkspaceSidebarProps) {
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isReposExpanded, setIsReposExpanded] = useState(false);
  const [isTasksExpanded, setIsTasksExpanded] = useState(true);

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
    <aside className="flex h-full w-[280px] shrink-0 flex-col bg-[#1c1c1c]">
      <div className="drag-region flex h-[38px] shrink-0 items-center justify-between px-2">
        <div className="flex items-center pl-[68px]">
          <button
            className="no-drag grid h-7 w-7 place-items-center rounded-control text-white/60 transition hover:bg-white/[0.12] hover:text-white"
            onClick={onToggleSidebar}
            title="Toggle sidebar"
            type="button"
          >
            <PanelLeft className="h-4 w-4" />
          </button>
        </div>
        <button
          className="no-drag grid h-7 w-7 place-items-center rounded-control text-white/60 transition hover:bg-white/[0.12] hover:text-white"
          title="History"
          type="button"
        >
          <History className="h-4 w-4" />
        </button>
      </div>

      <button
        className={clsx(
          'mb-[6px] flex items-center gap-2.5 rounded-lg px-3 py-[6px] font-geist text-[14px] font-medium transition',
          isReposExpanded
            ? 'bg-white/[0.14] text-white'
            : 'text-white/80 hover:bg-white/[0.03] hover:text-white'
        )}
        onClick={() => setIsReposExpanded((c) => !c)}
        type="button"
      >
        <Layers className="h-4 w-4" />
        Workspaces
      </button>

      {isReposExpanded ? (
        <div className="animate-fade-in border-t border-white/[0.10] bg-white/[0.06] px-3 py-2">
          {isLoadingProjects ? (
            <SidebarMessage>Loading repositories...</SidebarMessage>
          ) : null}

          <div className="space-y-0.5">
            {projects.map((entry) => {
              const isSelected = entry.id === selectedProjectId;

              return (
                <button
                  key={entry.id}
                  className={clsx(
                    'flex w-full items-center gap-2 rounded-control px-2 py-1.5 text-left transition',
                    isSelected
                      ? 'bg-white/[0.16] text-white'
                      : 'text-white/70 hover:bg-white/[0.10] hover:text-white'
                  )}
                  onClick={() => onSelectProject(entry.id)}
                  type="button"
                >
                  <FolderGit2 className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate font-geist text-[13px] font-medium">{entry.name}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-2 space-y-2 rounded-card border border-dashed border-white/[0.15] p-2">
            <button
              className={clsx(
                'flex w-full items-center justify-center gap-1.5 rounded-control border border-white/[0.15] bg-white/[0.06] px-2 py-1.5 text-[12px] font-medium text-white/80 transition',
                'hover:bg-white/[0.12] hover:text-white disabled:cursor-not-allowed disabled:opacity-50'
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
                'w-full rounded-control border border-white/[0.15] bg-black/[0.15] px-2 py-1.5 text-[12px] text-white outline-none transition',
                'placeholder:text-white/40 focus:border-white/30 focus:ring-1 focus:ring-white/10'
              )}
              onChange={(event) => onManualPathChange(event.target.value)}
              placeholder="~/Code/my-repo"
              value={manualPath}
            />
            <button
              className={clsx(
                'w-full rounded-control border border-white/[0.15] bg-white/[0.06] px-2 py-1.5 text-[12px] font-medium text-white/80 transition',
                'hover:bg-white/[0.12] hover:text-white disabled:cursor-not-allowed disabled:opacity-50'
              )}
              disabled={isAddingProject || manualPath.trim().length === 0}
              onClick={() => { void onSubmitManualPath(); }}
              type="button"
            >
              Use path
            </button>
            {projectErrorMessage ? (
              <p className="text-[12px] text-rose-200">{projectErrorMessage}</p>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {project ? (
          <>
            <div
              className="group/ws flex w-full items-center gap-2.5 px-4 py-2 transition hover:bg-white/[0.10]"
            >
              <button
                className="flex min-w-0 flex-1 items-center gap-2.5"
                onClick={() => setIsTasksExpanded((c) => !c)}
                type="button"
              >
                <div className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-white/[0.10] font-geist text-[11px] font-semibold uppercase text-white/70">
                  {project.name.charAt(0)}
                </div>
                <span className="min-w-0 truncate font-geist text-[14px] font-medium text-white/80">
                  {project.name}
                </span>
                {isTasksExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-white/40" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-white/40" />
                )}
              </button>
              <button
                className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-white/0 transition group-hover/ws:text-white/50 group-hover/ws:hover:bg-white/[0.12] group-hover/ws:hover:text-white"
                onClick={() => setIsComposerOpen((current) => !current)}
                title="New task"
                type="button"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>

            {isComposerOpen ? (
              <div className="animate-slide-up px-3 py-3">
                <div className="space-y-2 rounded-card border border-white/[0.12] bg-black/[0.10] p-3">
                  <input
                    className={clsx(
                      'w-full rounded-control border border-white/[0.15] bg-black/[0.15] px-3 py-1.5 font-geist text-[13px] text-white outline-none transition',
                      'placeholder:text-white/40 focus:border-white/30 focus:ring-1 focus:ring-white/10'
                    )}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Task title"
                    value={title}
                  />
                  <textarea
                    className={clsx(
                      'min-h-[64px] w-full resize-none rounded-control border border-white/[0.15] bg-black/[0.15] px-3 py-1.5 font-geist text-[13px] text-white outline-none transition',
                      'placeholder:text-white/40 focus:border-white/30 focus:ring-1 focus:ring-white/10'
                    )}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Optional notes"
                    value={description}
                  />
                  <button
                    className={clsx(
                      'flex w-full items-center justify-center rounded-control bg-white px-3 py-1.5 font-geist text-[13px] font-semibold text-[#1c1c1c] transition',
                      'hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50'
                    )}
                    disabled={!project || isCreatingTask || title.trim().length === 0}
                    onClick={() => { void handleCreateTask(); }}
                    type="button"
                  >
                    {isCreatingTask ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : null}
                    {isCreatingTask ? 'Creating...' : 'Create task'}
                  </button>
                  {createErrorMessage ? (
                    <p className="text-[12px] text-rose-200">{createErrorMessage}</p>
                  ) : null}
                </div>
              </div>
            ) : null}

            {isTasksExpanded ? (
              <div className="min-h-0 flex-1 space-y-0.5 overflow-auto px-3 py-1">
                {isLoadingTasks ? (
                  <SidebarMessage>
                    <Loader2 className="mr-1.5 inline h-3 w-3 animate-spin" />
                    Loading tasks...
                  </SidebarMessage>
                ) : null}

                {!isLoadingTasks && taskWorkspaces.length === 0 ? (
                  <SidebarMessage>No tasks yet.</SidebarMessage>
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
                              ? 'bg-white/[0.14] shadow-sm'
                              : 'hover:bg-white/[0.08]'
                          )}
                          onClick={() => onSelectTask(workspace.task.id)}
                          type="button"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className={clsx(
                              'truncate font-geist text-[13px] font-medium',
                              isSelected ? 'text-white' : 'text-white/80 group-hover:text-white'
                            )}>
                              {workspace.task.title}
                            </p>
                            <StatusDot status={workspace.task.status} />
                          </div>
                          <div className="mt-1 flex items-center gap-2 text-[11px] text-white/40">
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
            ) : null}
          </>
        ) : (
          <div className="px-4 py-3">
            <span className="font-geist text-[14px] text-white/40">No repository selected</span>
          </div>
        )}
      </div>
    </aside>
  );
}

function StatusDot({ status }: { status: TaskWorkspace['task']['status'] }) {
  const colors: Record<TaskWorkspace['task']['status'], string> = {
    archived: 'bg-white/40',
    completed: 'bg-emerald-300',
    draft: 'bg-amber-300',
    failed: 'bg-rose-300',
    in_progress: 'bg-sky-200',
    needs_review: 'bg-violet-300',
    ready: 'bg-white'
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
    <p className="px-1 py-2 text-[12px] text-white/40">{children}</p>
  );
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric'
  }).format(new Date(value));
}
