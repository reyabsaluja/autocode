import type { Project } from '@shared/domain/project';

interface ProjectSidebarProps {
  projects: Project[];
  isLoading: boolean;
  isAddingProject: boolean;
  errorMessage: string | null;
  manualPath: string;
  selectedProjectId: number | null;
  onAddRepository: () => Promise<void>;
  onManualPathChange: (value: string) => void;
  onSubmitManualPath: () => Promise<void>;
  onSelectProject: (projectId: number | null) => void;
}

export function ProjectSidebar({
  projects,
  isLoading,
  isAddingProject,
  errorMessage,
  manualPath,
  selectedProjectId,
  onAddRepository,
  onManualPathChange,
  onSubmitManualPath,
  onSelectProject
}: ProjectSidebarProps) {
  return (
    <aside className="flex w-[360px] shrink-0 flex-col rounded-[32px] border border-slate-900/10 bg-slate-950 px-5 py-5 text-slate-100 shadow-panel">
      <div className="rounded-[28px] border border-white/10 bg-white/5 px-5 py-5">
        <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Autocode</p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight">Projects</h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          Repositories are the anchor for tasks, worktrees, and agent sessions.
        </p>

        <button
          className="mt-5 inline-flex items-center justify-center rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-600 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={() => {
            void onAddRepository();
          }}
          disabled={isAddingProject}
        >
          {isAddingProject ? 'Adding repository...' : 'Add local repository'}
        </button>

        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
            Or enter a repo path
          </p>
          <div className="mt-3 space-y-3">
            <input
              className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-accent focus:ring-2 focus:ring-teal-500/20"
              onChange={(event) => onManualPathChange(event.target.value)}
              placeholder="/Users/reyab/Code/my-repo"
              value={manualPath}
            />
            <button
              className="inline-flex w-full items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isAddingProject || manualPath.trim().length === 0}
              onClick={() => {
                void onSubmitManualPath();
              }}
              type="button"
            >
              {isAddingProject ? 'Connecting repository...' : 'Use this path'}
            </button>
          </div>
        </div>

        {errorMessage ? <p className="mt-3 text-sm text-rose-300">{errorMessage}</p> : null}
      </div>

      <div className="mt-5 flex min-h-0 flex-1 flex-col">
        <div className="mb-3 flex items-center justify-between px-1">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Tracked repos</p>
          <span className="rounded-full border border-white/10 px-2 py-1 text-xs text-slate-300">
            {projects.length}
          </span>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
          {isLoading ? <LoadingState /> : null}

          {!isLoading && projects.length === 0 ? <EmptyState /> : null}

          {!isLoading
            ? projects.map((project) => {
                const isSelected = project.id === selectedProjectId;

                return (
                  <button
                    key={project.id}
                    className={`w-full rounded-3xl border px-4 py-4 text-left transition ${
                      isSelected
                        ? 'border-accent bg-teal-500/10'
                        : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.07]'
                    }`}
                    onClick={() => onSelectProject(project.id)}
                  >
                    <p className="text-base font-semibold text-white">{project.name}</p>
                    <p className="mt-1 line-clamp-1 text-sm text-slate-300">{project.repoPath}</p>
                    <p className="mt-3 text-xs uppercase tracking-[0.2em] text-slate-500">
                      Ready for tasks
                    </p>
                  </button>
                );
              })
            : null}
        </div>
      </div>
    </aside>
  );
}

function LoadingState() {
  return (
    <div className="space-y-3">
      <div className="h-24 animate-pulse rounded-3xl border border-white/10 bg-white/[0.04]" />
      <div className="h-24 animate-pulse rounded-3xl border border-white/10 bg-white/[0.04]" />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-6">
      <p className="text-sm font-medium text-white">No repositories yet.</p>
      <p className="mt-2 text-sm leading-6 text-slate-300">
        Add a local Git repo to start building the task → worktree → agent loop.
      </p>
    </div>
  );
}
