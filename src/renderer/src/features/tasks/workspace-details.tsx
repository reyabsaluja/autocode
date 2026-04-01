import { forwardRef, useEffect, useState } from 'react';
import { AlertTriangle, FolderGit2, GitBranch, Loader2 } from 'lucide-react';

import type { Project } from '@shared/domain/project';
import type { TaskWorkspace } from '@shared/domain/task-workspace';

import type { WorkspaceEditorHandle } from '../editor/workspace-editor-surface';

type WorkspaceInspectorComponent = typeof import('../workspace/workspace-inspector')['WorkspaceInspector'];

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
  const [WorkspaceInspectorComponent, setWorkspaceInspectorComponent] =
    useState<WorkspaceInspectorComponent | null>(null);

  useEffect(() => {
    if (!taskWorkspace?.worktree || WorkspaceInspectorComponent) {
      return;
    }

    let isCancelled = false;

    void import('../workspace/workspace-inspector').then((module) => {
      if (!isCancelled) {
        setWorkspaceInspectorComponent(() => module.WorkspaceInspector);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [WorkspaceInspectorComponent, taskWorkspace?.worktree]);

  if (!project) {
    return (
      <section className="grid h-full animate-fade-in place-items-center">
        <div className="max-w-sm text-center">
          <FolderGit2 className="mx-auto mb-3 h-7 w-7 text-white/12" />
          <p className="font-geist text-[13px] text-white/35">
            Add or select a repository to open its workspaces.
          </p>
        </div>
      </section>
    );
  }

  if (isLoadingTasks) {
    return (
      <section className="grid h-full animate-fade-in place-items-center">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-white/25" />
          <p className="font-geist text-[13px] text-white/35">Loading workspaces</p>
        </div>
      </section>
    );
  }

  if (!taskWorkspace) {
    return (
      <section className="grid h-full animate-fade-in place-items-center">
        <div className="max-w-sm text-center">
          <p className="font-geist text-[13px] text-white/35">
            Create or select a workspace in <span className="font-medium text-white/60">{project.name}</span>.
          </p>
        </div>
      </section>
    );
  }

  const { task, worktree } = taskWorkspace;

  return (
    <section className="flex h-full flex-col animate-fade-in">
      <header className="flex h-[38px] shrink-0 items-center border-b border-white/[0.06] bg-[#141414] px-4">
        <p className="min-w-0 truncate font-geist text-[13px] font-semibold text-white/90">{task.title}</p>

        <div className="ml-auto flex shrink-0 items-center gap-2 pl-4">
          <HeaderBadge icon={<FolderGit2 className="h-3 w-3" />} value={project.name} />
          {worktree ? (
            <HeaderBadge icon={<GitBranch className="h-3 w-3" />} value={worktree.branchName} />
          ) : null}
        </div>
      </header>

      {task.lastError ? (
        <div className="flex items-center gap-2 border-b border-rose-500/15 bg-rose-500/[0.04] px-4 py-2 font-geist text-[12px] text-rose-300">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {task.lastError}
        </div>
      ) : null}

      {worktree ? (
        WorkspaceInspectorComponent ? (
          <WorkspaceInspectorComponent
            key={taskWorkspace.task.id}
            ref={ref}
            taskWorkspace={taskWorkspace}
          />
        ) : (
          <div className="grid min-h-0 flex-1 animate-fade-in place-items-center">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-white/25" />
              <p className="font-geist text-[13px] text-white/35">Opening workspace tools</p>
            </div>
          </div>
        )
      ) : (
        <div className="grid min-h-[280px] place-items-center">
          <p className="font-geist text-[13px] text-white/35">
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
    <span className="flex items-center gap-1 rounded bg-white/[0.06] px-1.5 py-0.5 font-geist text-[11px] text-white/45">
      {icon ? <span className="text-white/30">{icon}</span> : null}
      <span className="max-w-[140px] truncate">{value}</span>
    </span>
  );
}

