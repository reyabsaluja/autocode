import type { Project } from '@shared/domain/project';

interface ProjectDetailsProps {
  project: Project | null;
  isLoading: boolean;
}

export function ProjectDetails({ project, isLoading }: ProjectDetailsProps) {
  if (isLoading) {
    return (
      <section className="flex flex-1 items-center justify-center rounded-[32px] border border-white/60 bg-white/70 shadow-panel backdrop-blur">
        <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Loading workspace</p>
      </section>
    );
  }

  if (!project) {
    return (
      <section className="grid flex-1 place-items-center rounded-[32px] border border-white/60 bg-white/70 p-8 shadow-panel backdrop-blur">
        <div className="max-w-xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-accent">
            Local-first foundation
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
            Pick a repository to make the agent workspace concrete.
          </h2>
          <p className="mt-4 text-base leading-7 text-slate-600">
            The first durable object in Autocode is the project itself. Once that exists, tasks,
            worktrees, sessions, logs, and diffs all have somewhere real to attach.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="grid flex-1 grid-cols-[1.2fr,0.8fr] gap-6">
      <div className="rounded-[32px] border border-white/60 bg-white/75 p-8 shadow-panel backdrop-blur">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-accent">
          Selected repository
        </p>
        <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
          {project.name}
        </h2>
        <dl className="mt-8 grid gap-5">
          <DetailRow
            label="Git root"
            value={project.gitRoot}
          />
          <DetailRow
            label="Stored path"
            value={project.repoPath}
          />
          <DetailRow
            label="Created"
            value={formatDate(project.createdAt)}
          />
          <DetailRow
            label="Last touched"
            value={formatDate(project.updatedAt)}
          />
        </dl>
      </div>

      <div className="flex flex-col gap-6">
        <div className="rounded-[32px] border border-slate-900/10 bg-slate-950 p-6 text-slate-100 shadow-panel">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Control center</p>
          <h3 className="mt-3 text-2xl font-semibold">What comes next</h3>
          <ul className="mt-5 space-y-4 text-sm leading-6 text-slate-300">
            <li>Tasks become durable units of work scoped to this repository.</li>
            <li>Each task provisions its own isolated git worktree.</li>
            <li>Agent sessions attach to worktrees and stream logs and diffs back here.</li>
          </ul>
        </div>

        <div className="rounded-[32px] border border-slate-900/10 bg-sand/70 p-6 shadow-panel">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Vertical slice</p>
          <p className="mt-3 text-lg font-semibold tracking-tight text-slate-950">
            Projects are persisted in SQLite through Drizzle and loaded through Electron IPC.
          </p>
          <p className="mt-3 text-sm leading-6 text-slate-700">
            This keeps the renderer focused on UX while the main process owns filesystem access,
            git inspection, and local persistence.
          </p>
        </div>
      </div>
    </section>
  );
}

interface DetailRowProps {
  label: string;
  value: string;
}

function DetailRow({ label, value }: DetailRowProps) {
  return (
    <div className="rounded-3xl border border-slate-200/80 bg-slate-50/80 px-4 py-4">
      <dt className="text-xs uppercase tracking-[0.22em] text-slate-500">{label}</dt>
      <dd className="mt-2 break-all text-sm leading-6 text-slate-800">{value}</dd>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

