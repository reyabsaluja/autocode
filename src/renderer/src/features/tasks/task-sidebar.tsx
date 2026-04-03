import { useState } from 'react';

import type { Project } from '@shared/domain/project';
import type { TaskWorkspace } from '@shared/domain/task-workspace';

interface TaskSidebarProps {
  createErrorMessage: string | null;
  isCreatingTask: boolean;
  isLoading: boolean;
  project: Project | null;
  selectedTaskId: number | null;
  tasks: TaskWorkspace[];
  onCreateTask: (input: { description: string; title: string }) => Promise<void>;
  onSelectTask: (taskId: number | null) => void;
}

export function TaskSidebar({
  createErrorMessage,
  isCreatingTask,
  isLoading,
  project,
  selectedTaskId,
  tasks,
  onCreateTask,
  onSelectTask
}: TaskSidebarProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    await onCreateTask({
      description,
      title
    });

    setTitle('');
    setDescription('');
  };

  if (!project) {
    return (
      <aside className="flex w-[380px] shrink-0 flex-col rounded-[32px] border border-slate-900/10 bg-white/70 px-5 py-5 shadow-panel backdrop-blur">
        <div className="grid flex-1 place-items-center rounded-[28px] border border-dashed border-slate-200 bg-slate-50/80 p-8 text-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-500">
              Task workspaces
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
              Select a repository first
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Tasks become isolated workspaces once they are attached to a project.
            </p>
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="flex w-[380px] shrink-0 flex-col rounded-[32px] border border-slate-900/10 bg-white/70 px-5 py-5 shadow-panel backdrop-blur">
      <div className="rounded-[28px] border border-slate-200/80 bg-slate-50/90 px-5 py-5">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-accent">Workspace</p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
          Start a task in {project.name}
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Creating a task provisions its own branch and isolated git worktree automatically.
        </p>

        <form
          className="mt-5 space-y-3"
          onSubmit={(event) => {
            void handleSubmit(event);
          }}
        >
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
              Title
            </span>
            <input
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-accent focus:ring-2 focus:ring-teal-100"
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Implement task workspace creation"
              value={title}
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
              Prompt or notes
            </span>
            <textarea
              className="min-h-[110px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-accent focus:ring-2 focus:ring-teal-100"
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Optional context for what should happen in this workspace."
              value={description}
            />
          </label>

          <button
            className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isCreatingTask || title.trim().length === 0}
            type="submit"
          >
            {isCreatingTask ? 'Provisioning workspace...' : 'Create task workspace'}
          </button>
        </form>

        {createErrorMessage ? (
          <p className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-3 text-sm text-rose-700">
            {createErrorMessage}
          </p>
        ) : null}
      </div>

      <div className="mt-5 flex min-h-0 flex-1 flex-col">
        <div className="mb-3 flex items-center justify-between px-1">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Task workspaces</p>
          <span className="rounded-full border border-slate-200 px-2 py-1 text-xs text-slate-500">
            {tasks.length}
          </span>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
          {isLoading ? <LoadingState /> : null}
          {!isLoading && tasks.length === 0 ? <EmptyState /> : null}

          {!isLoading
            ? tasks.map((workspace) => {
                const isSelected = workspace.task.id === selectedTaskId;

                return (
                  <button
                    key={workspace.task.id}
                    className={`w-full rounded-3xl border px-4 py-4 text-left transition ${
                      isSelected
                        ? 'border-accent bg-teal-50'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                    }`}
                    onClick={() => onSelectTask(workspace.task.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-base font-semibold text-slate-950">
                          {workspace.task.title}
                        </p>
                        <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-600">
                          {workspace.task.description ?? 'No prompt yet. This workspace is ready for work.'}
                        </p>
                      </div>
                      <StatusBadge status={workspace.task.status} />
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-3 text-xs uppercase tracking-[0.18em] text-slate-500">
                      <span>{workspace.worktree?.branchName ?? 'Workspace pending'}</span>
                      <span>{formatShortDate(workspace.task.updatedAt)}</span>
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

function EmptyState() {
  return (
    <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-6">
      <p className="text-sm font-medium text-slate-900">No task workspaces yet.</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Create one to provision an isolated branch and worktree you can come back to anytime.
      </p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-3">
      <div className="h-24 animate-pulse rounded-3xl border border-slate-200 bg-slate-100" />
      <div className="h-24 animate-pulse rounded-3xl border border-slate-200 bg-slate-100" />
    </div>
  );
}

function StatusBadge({ status }: { status: TaskWorkspace['task']['status'] }) {
  const styles: Record<TaskWorkspace['task']['status'], string> = {
    archived: 'border-slate-200 bg-slate-100 text-slate-600',
    completed: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    draft: 'border-amber-200 bg-amber-50 text-amber-700',
    failed: 'border-rose-200 bg-rose-50 text-rose-700',
    in_progress: 'border-sky-200 bg-sky-50 text-sky-700',
    needs_review: 'border-violet-200 bg-violet-50 text-violet-700',
    ready: 'border-teal-200 bg-teal-50 text-teal-700'
  };

  return (
    <span className={`rounded-full border px-2 py-1 text-[11px] font-semibold uppercase ${styles[status]}`}>
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
