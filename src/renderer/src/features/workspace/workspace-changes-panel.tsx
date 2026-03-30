import type { WorkspaceChange } from '@shared/domain/workspace-inspection';

interface WorkspaceChangesPanelProps {
  changes: WorkspaceChange[];
  commitErrorMessage: string | null;
  commitMessage: string;
  commitNotice: string | null;
  isCommitting: boolean;
  isLoading: boolean;
  loadErrorMessage: string | null;
  onCommit: () => Promise<void>;
  onCommitMessageChange: (value: string) => void;
  onRefresh: () => Promise<void>;
  onSelectChange: (path: string) => void;
  selectedPath: string | null;
}

export function WorkspaceChangesPanel({
  changes,
  commitErrorMessage,
  commitMessage,
  commitNotice,
  isCommitting,
  isLoading,
  loadErrorMessage,
  onCommit,
  onCommitMessageChange,
  onRefresh,
  onSelectChange,
  selectedPath
}: WorkspaceChangesPanelProps) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[20px] border border-white/6 bg-[#0d0e11]">
      <div className="border-b border-white/6 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              Workspace changes
            </p>
          </div>
          <button
            className="rounded-xl border border-white/8 bg-white/[0.04] px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/[0.08]"
            onClick={() => {
              void onRefresh();
            }}
            type="button"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-2 py-2">
        {isLoading ? <PanelMessage label="Checking workspace changes" /> : null}
        {loadErrorMessage ? <PanelMessage label={loadErrorMessage} tone="error" /> : null}
        {!isLoading && !loadErrorMessage && changes.length === 0 ? (
          <PanelMessage label="No changes in this workspace right now." />
        ) : null}

        {!isLoading && !loadErrorMessage ? (
          <ul className="space-y-2">
            {changes.map((change) => {
              const isSelected = change.relativePath === selectedPath;

              return (
                <li key={`${change.status}:${change.relativePath}`}>
                  <button
                    className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                      isSelected
                        ? 'border-white/10 bg-white/[0.08]'
                        : 'border-white/6 bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.05]'
                    }`}
                    onClick={() => onSelectChange(change.relativePath)}
                    type="button"
                  >
                    <div className="flex items-center justify-between gap-3">
                        <p className="truncate text-sm font-medium text-slate-100">
                          {change.relativePath}
                        </p>
                      <ChangeStatusBadge status={change.status} />
                    </div>

                    {change.previousPath ? (
                      <p className="mt-2 text-xs uppercase tracking-[0.16em] text-slate-500">
                        From {change.previousPath}
                      </p>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>

      <div className="border-t border-white/6 px-4 py-4">
        <label className="block">
          <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            Commit
          </span>
          <textarea
            className="mt-3 min-h-[88px] w-full rounded-xl border border-white/8 bg-[#090a0c] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-teal-400/40 focus:ring-2 focus:ring-teal-400/10"
            onChange={(event) => onCommitMessageChange(event.target.value)}
            placeholder="Describe the workspace changes"
            value={commitMessage}
          />
        </label>

        <button
          className="mt-3 inline-flex w-full items-center justify-center rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isCommitting || changes.length === 0 || commitMessage.trim().length === 0}
          onClick={() => {
            void onCommit();
          }}
          type="button"
        >
          {isCommitting ? 'Committing changes...' : 'Commit selected workspace changes'}
        </button>

        {commitNotice ? (
          <p className="mt-3 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-3 text-sm text-emerald-200">
            {commitNotice}
          </p>
        ) : null}

        {commitErrorMessage ? (
          <p className="mt-3 rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-3 text-sm text-rose-200">
            {commitErrorMessage}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function ChangeStatusBadge({ status }: { status: WorkspaceChange['status'] }) {
  const styles: Record<WorkspaceChange['status'], string> = {
    added: 'border border-emerald-400/20 bg-emerald-400/10 text-emerald-200',
    deleted: 'border border-rose-400/20 bg-rose-400/10 text-rose-200',
    modified: 'border border-sky-400/20 bg-sky-400/10 text-sky-200',
    renamed: 'border border-violet-400/20 bg-violet-400/10 text-violet-200',
    untracked: 'border border-amber-400/20 bg-amber-400/10 text-amber-200'
  };

  return (
    <span className={`rounded-full px-2 py-1 text-[11px] font-semibold uppercase ${styles[status]}`}>
      {status}
    </span>
  );
}

function PanelMessage({ label, tone = 'subtle' }: { label: string; tone?: 'error' | 'subtle' }) {
  return (
    <p className={`px-2 py-2 text-sm ${tone === 'error' ? 'text-rose-300' : 'text-slate-500'}`}>
      {label}
    </p>
  );
}
