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
      <section className="grid h-full animate-fade-in place-items-center bg-surface-0">
        <div className="max-w-sm text-center">
          <FolderGit2 className="mx-auto mb-3 h-8 w-8 text-white/15" />
          <p className="font-geist text-[13px] text-white/40">
            Add or select a repository to open its workspaces.
          </p>
        </div>
      </section>
    );
  }

  if (isLoadingTasks) {
    return (
      <section className="grid h-full animate-fade-in place-items-center bg-surface-0">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-white/30" />
          <p className="font-geist text-[13px] text-white/40">Loading workspaces</p>
        </div>
      </section>
    );
  }

  if (!taskWorkspace) {
    return (
      <section className="grid h-full animate-fade-in place-items-center bg-surface-0">
        <div className="max-w-sm text-center">
          <p className="font-geist text-[13px] text-white/40">
            Create or select a workspace in <span className="font-medium text-white/70">{project.name}</span>.
          </p>
        </div>
      </section>
    );
  }

  const { task, worktree } = taskWorkspace;

  return (
    <section className="flex h-full flex-col animate-fade-in">
      <header className="flex items-center justify-between border-b border-white/[0.06] bg-surface-0 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="min-w-0">
            <p className="truncate font-geist text-[14px] font-semibold text-white/90">{task.title}</p>
            {task.description ? (
              <p className="mt-0.5 truncate font-geist text-[12px] text-white/40">{task.description}</p>
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
        <div className="flex items-center gap-2 border-b border-rose-500/20 bg-rose-500/[0.04] px-4 py-2.5 font-geist text-[13px] text-rose-300">
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
        <div className="grid min-h-[280px] place-items-center bg-surface-0">
          <p className="font-geist text-[13px] text-white/40">
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
    <span className="flex items-center gap-1 rounded-md bg-white/[0.06] px-2 py-1 font-geist text-[11px] font-medium text-white/50">
      {icon}
      <span className="max-w-[120px] truncate">{value}</span>
    </span>
  );
}

function TaskStatusBadge({ status }: { status: TaskWorkspace['task']['status'] }) {
  const styles: Record<TaskWorkspace['task']['status'], string> = {
    archived: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
    completed: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
    draft: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
    failed: 'bg-rose-500/10 text-rose-300 border-rose-500/20',
    in_progress: 'bg-sky-500/10 text-sky-300 border-sky-500/20',
    needs_review: 'bg-violet-500/10 text-violet-300 border-violet-500/20',
    ready: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
  };

  return (
    <span className={clsx(
      'rounded-md border px-2 py-1 font-geist text-[10px] font-bold uppercase tracking-[0.08em]',
      styles[status]
    )}>
      {status.replace('_', ' ')}
    </span>
  );
}

function WorktreeStatusBadge({ status }: { status: WorktreeStatus }) {
  const styles: Record<WorktreeStatus, string> = {
    archived: 'bg-zinc-500/10 text-zinc-400',
    dirty: 'bg-amber-500/10 text-amber-300',
    failed: 'bg-rose-500/10 text-rose-300',
    provisioning: 'bg-sky-500/10 text-sky-300',
    ready: 'bg-emerald-500/10 text-emerald-300'
  };

  return (
    <span className={clsx(
      'rounded-md px-2 py-1 font-geist text-[10px] font-bold uppercase tracking-[0.08em]',
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
