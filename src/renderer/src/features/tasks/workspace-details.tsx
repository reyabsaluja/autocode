import type { Project } from '@shared/domain/project';
import type { TaskWorkspace } from '@shared/domain/task-workspace';

import { WorkspaceInspector } from '../workspace/workspace-inspector';

interface WorkspaceDetailsProps {
  isLoadingTasks: boolean;
  project: Project | null;
  taskWorkspace: TaskWorkspace | null;
}

export function WorkspaceDetails({
  isLoadingTasks,
  project,
  taskWorkspace
}: WorkspaceDetailsProps) {
  if (!project) {
    return (
      <section className="grid h-full place-items-center rounded-[28px] border border-white/6 bg-[#101114] p-8 shadow-[0_24px_80px_rgba(0,0,0,0.32)]">
        <div className="max-w-xl text-center">
          <p className="text-sm text-slate-500">Add or select a repository to open its workspaces.</p>
        </div>
      </section>
    );
  }

  if (isLoadingTasks) {
    return (
      <section className="grid h-full place-items-center rounded-[28px] border border-white/6 bg-[#101114] p-8 shadow-[0_24px_80px_rgba(0,0,0,0.32)]">
        <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Loading workspaces</p>
      </section>
    );
  }

  if (!taskWorkspace) {
    return (
      <section className="grid h-full place-items-center rounded-[28px] border border-white/6 bg-[#101114] p-8 shadow-[0_24px_80px_rgba(0,0,0,0.32)]">
        <div className="max-w-2xl text-center">
          <p className="text-sm text-slate-500">Create or select a workspace in {project.name}.</p>
        </div>
      </section>
    );
  }

  const { task, worktree } = taskWorkspace;

  return (
    <section className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between rounded-[24px] border border-white/6 bg-[#101114] px-4 py-3 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{task.title}</p>
          <p className="mt-1 truncate text-xs text-slate-500">
            {task.description ?? 'No notes'}
          </p>
        </div>
        <div className="ml-4 flex items-center gap-2">
          <CompactBadge value={project.name} />
          <CompactBadge value={worktree?.branchName ?? 'No branch'} />
          <CompactBadge value={humanizeStatus(task.status)} tone="accent" />
          <CompactBadge value={formatDate(task.updatedAt)} />
        </div>
      </div>

      {worktree ? (
        <WorkspaceInspector taskWorkspace={taskWorkspace} />
      ) : (
        <div className="grid min-h-[320px] place-items-center rounded-[28px] border border-white/6 bg-[#101114] p-8 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
          <div className="max-w-xl text-center">
            <p className="text-sm text-slate-500">This task does not have an active worktree yet.</p>
          </div>
        </div>
      )}
    </section>
  );
}

function CompactBadge({
  tone = 'neutral',
  value
}: {
  tone?: 'accent' | 'neutral';
  value: string;
}) {
  return (
    <span
      className={`rounded-xl px-3 py-2 text-xs font-medium ${
        tone === 'accent'
          ? 'bg-teal-500/14 text-teal-200'
          : 'bg-white/[0.05] text-slate-300'
      }`}
    >
      {value}
    </span>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

function humanizeStatus(status: TaskWorkspace['task']['status']) {
  return status.replaceAll('_', ' ');
}
