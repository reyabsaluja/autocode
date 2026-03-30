import type { Project } from '@shared/domain/project';
import type { TaskWorkspace } from '@shared/domain/task-workspace';

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
      <section className="grid flex-1 place-items-center rounded-[32px] border border-white/60 bg-white/70 p-8 shadow-panel backdrop-blur">
        <div className="max-w-xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-accent">
            AI Agent IDE
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
            Choose a repository to begin.
          </h2>
          <p className="mt-4 text-base leading-7 text-slate-600">
            Projects anchor task workspaces, isolated worktrees, and everything that follows in
            Autocode.
          </p>
        </div>
      </section>
    );
  }

  if (isLoadingTasks) {
    return (
      <section className="grid flex-1 place-items-center rounded-[32px] border border-white/60 bg-white/70 p-8 shadow-panel backdrop-blur">
        <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Loading workspaces</p>
      </section>
    );
  }

  if (!taskWorkspace) {
    return (
      <section className="grid flex-1 place-items-center rounded-[32px] border border-white/60 bg-white/70 p-8 shadow-panel backdrop-blur">
        <div className="max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-accent">
            {project.name}
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
            Create a task workspace to start isolated work.
          </h2>
          <p className="mt-4 text-base leading-7 text-slate-600">
            Each task gets its own branch and worktree so you can leave it, come back later, and
            keep multiple streams of work separated safely.
          </p>
        </div>
      </section>
    );
  }

  const { task, worktree } = taskWorkspace;

  return (
    <section className="grid flex-1 grid-cols-[1.15fr,0.85fr] gap-6">
      <div className="rounded-[32px] border border-white/60 bg-white/75 p-8 shadow-panel backdrop-blur">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-accent">
          Task workspace
        </p>
        <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">{task.title}</h2>
        <p className="mt-4 text-base leading-7 text-slate-600">
          {task.description ??
            'This workspace was created without a prompt. It is still a durable isolated environment ready to resume.'}
        </p>

        <dl className="mt-8 grid gap-5">
          <DetailRow
            label="Status"
            value={humanizeStatus(task.status)}
          />
          <DetailRow
            label="Branch"
            value={worktree?.branchName ?? 'Not provisioned'}
          />
          <DetailRow
            label="Environment"
            value={
              worktree
                ? 'Managed locally in an isolated git worktree for this task.'
                : 'No worktree is currently attached to this task.'
            }
          />
          <DetailRow
            label="Created"
            value={formatDate(task.createdAt)}
          />
          <DetailRow
            label="Last updated"
            value={formatDate(task.updatedAt)}
          />
        </dl>
      </div>

      <div className="flex flex-col gap-6">
        <div className="rounded-[32px] border border-slate-900/10 bg-slate-950 p-6 text-slate-100 shadow-panel">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Workspace behavior</p>
          <h3 className="mt-3 text-2xl font-semibold">Resumable by default</h3>
          <ul className="mt-5 space-y-4 text-sm leading-6 text-slate-300">
            <li>This task reuses its existing worktree instead of recalculating anything on reopen.</li>
            <li>Its branch and local environment stay attached to the task over time.</li>
            <li>Other tasks in the same repo stay isolated because they each have their own worktree.</li>
          </ul>
        </div>

        <div className="rounded-[32px] border border-slate-900/10 bg-sand/70 p-6 shadow-panel">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Prompt</p>
          <p className="mt-3 text-sm leading-7 text-slate-700">
            {task.description ?? 'No prompt captured yet for this workspace.'}
          </p>

          {task.lastError ? (
            <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm leading-6 text-rose-700">
              <p className="font-semibold">Last workspace error</p>
              <p className="mt-2">{task.lastError}</p>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-slate-200/80 bg-slate-50/80 px-4 py-4">
      <dt className="text-xs uppercase tracking-[0.22em] text-slate-500">{label}</dt>
      <dd className="mt-2 break-words text-sm leading-6 text-slate-800">{value}</dd>
    </div>
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
