import { forwardRef } from 'react';
import clsx from 'clsx';
import { AlertTriangle, Clock, FolderGit2, GitBranch, Loader2 } from 'lucide-react';

import type { Project } from '@shared/domain/project';
import type { TaskWorkspace } from '@shared/domain/task-workspace';
import type { WorktreeStatus } from '@shared/domain/worktree';

import type { WorkspaceEditorHandle } from '../editor/workspace-editor-surface';
import { WorkspaceInspector } from '../workspace/workspace-inspector';

interface WorkspaceDetailsProps {
  isLoadingTasks: boolean;
  project: Project | null;
  taskWorkspace: TaskWorkspace | null;
}

export const WorkspaceDetails = forwardRef<WorkspaceEditorHandle, WorkspaceDetailsProps>(function WorkspaceDetails({
  isLoadingTasks,
  project,
  taskWorkspace
}, ref) {
  if (!project) {
    return (
      <section className="grid h-full animate-fade-in place-items-center rounded-panel border border-border bg-surface-2">
        <div className="max-w-sm text-center">
          <FolderGit2 className="mx-auto mb-3 h-8 w-8 text-text-faint" />
          <p className="text-[13px] text-text-muted">
            Add or select a repository to open its workspaces.
          </p>
        </div>
      </section>
    );
  }

  if (isLoadingTasks) {
    return (
      <section className="grid h-full animate-fade-in place-items-center rounded-panel border border-border bg-surface-2">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-text-faint" />
          <p className="text-[13px] text-text-muted">Loading workspaces</p>
        </div>
      </section>
    );
  }

  if (!taskWorkspace) {
    return (
      <section className="grid h-full animate-fade-in place-items-center rounded-panel border border-border bg-surface-2">
        <div className="max-w-sm text-center">
          <p className="text-[13px] text-text-muted">
            Create or select a workspace in <span className="font-medium text-text-primary">{project.name}</span>.
          </p>
        </div>
      </section>
    );
  }

  const { task, worktree } = taskWorkspace;

  return (
    <section className="flex h-full flex-col gap-2.5 animate-fade-in">
      <header className="flex items-center justify-between rounded-panel border border-border bg-surface-2 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="min-w-0">
            <p className="truncate text-[14px] font-semibold text-text-primary">{task.title}</p>
            {task.description ? (
              <p className="mt-0.5 truncate text-[12px] text-text-muted">{task.description}</p>
            ) : null}
          </div>
        </div>

        <div className="ml-4 flex items-center gap-1.5">
          <HeaderBadge icon={<FolderGit2 className="h-3 w-3" />} value={project.name} />
          {worktree ? (
            <HeaderBadge icon={<GitBranch className="h-3 w-3" />} value={worktree.branchName} />
          ) : null}
          {worktree ? (
            <WorktreeStatusBadge status={worktree.status} />
          ) : null}
          <TaskStatusBadge status={task.status} />
          <HeaderBadge icon={<Clock className="h-3 w-3" />} value={formatDate(task.updatedAt)} />
        </div>
      </header>

      {task.lastError ? (
        <div className="flex items-center gap-2 rounded-card border border-rose-500/20 bg-rose-500/[0.06] px-4 py-2.5 text-[13px] text-rose-300">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {task.lastError}
        </div>
      ) : null}

      {worktree ? (
        <WorkspaceInspector
          key={taskWorkspace.task.id}
          ref={ref}
          taskWorkspace={taskWorkspace}
        />
      ) : (
        <div className="grid min-h-[280px] place-items-center rounded-panel border border-border bg-surface-2">
          <p className="text-[13px] text-text-muted">
            This task does not have an active worktree yet.
          </p>
        </div>
      )}
    </section>
  );
});

function HeaderBadge({
  icon,
  value
}: {
  icon?: React.ReactNode;
  value: string;
}) {
  return (
    <span className="flex items-center gap-1 rounded-control bg-white/[0.04] px-2 py-1 text-[11px] font-medium text-text-secondary">
      {icon}
      <span className="max-w-[120px] truncate">{value}</span>
    </span>
  );
}

function TaskStatusBadge({ status }: { status: TaskWorkspace['task']['status'] }) {
  const styles: Record<TaskWorkspace['task']['status'], string> = {
    archived: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
    completed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    draft: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    failed: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    in_progress: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
    needs_review: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
    ready: 'bg-accent-dim text-accent border-accent-muted'
  };

  return (
    <span className={clsx(
      'rounded-control border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em]',
      styles[status]
    )}>
      {status.replace('_', ' ')}
    </span>
  );
}

function WorktreeStatusBadge({ status }: { status: WorktreeStatus }) {
  const styles: Record<WorktreeStatus, string> = {
    archived: 'bg-zinc-500/10 text-zinc-400',
    dirty: 'bg-amber-500/10 text-amber-400',
    failed: 'bg-rose-500/10 text-rose-400',
    provisioning: 'bg-sky-500/10 text-sky-400',
    ready: 'bg-emerald-500/10 text-emerald-400'
  };

  return (
    <span className={clsx(
      'rounded-control px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em]',
      styles[status]
    )}>
      {status}
    </span>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}
