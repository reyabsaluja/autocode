import clsx from 'clsx';
import { GitCommitHorizontal, Loader2, RefreshCw } from 'lucide-react';

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
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-card border border-border bg-surface-1">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted">
          Changes
        </p>
        <button
          className="grid h-6 w-6 place-items-center rounded-control text-text-faint transition hover:bg-white/[0.06] hover:text-text-secondary"
          onClick={() => { void onRefresh(); }}
          title="Refresh changes"
          type="button"
        >
          <RefreshCw className="h-3 w-3" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-1 py-1">
        {isLoading ? (
          <PanelMessage>
            <Loader2 className="mr-1.5 inline h-3 w-3 animate-spin" />
            Checking changes
          </PanelMessage>
        ) : null}

        {loadErrorMessage ? (
          <PanelMessage tone="error">{loadErrorMessage}</PanelMessage>
        ) : null}

        {!isLoading && !loadErrorMessage && changes.length === 0 ? (
          <PanelMessage>No changes detected.</PanelMessage>
        ) : null}

        {!isLoading && !loadErrorMessage ? (
          <ul className="space-y-0.5">
            {changes.map((change) => {
              const isSelected = change.relativePath === selectedPath;

              return (
                <li key={`${change.status}:${change.relativePath}`}>
                  <button
                    className={clsx(
                      'flex w-full items-center gap-2 rounded-control px-2 py-[5px] text-left transition',
                      isSelected
                        ? 'bg-white/[0.08] text-text-primary'
                        : 'text-text-secondary hover:bg-white/[0.04] hover:text-text-primary'
                    )}
                    onClick={() => onSelectChange(change.relativePath)}
                    type="button"
                  >
                    <ChangeStatusIndicator status={change.status} />
                    <span className="min-w-0 truncate text-[12px]">{change.relativePath}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>

      <div className="border-t border-border px-3 py-3">
        <div className="flex items-center gap-1.5 mb-2">
          <GitCommitHorizontal className="h-3 w-3 text-text-faint" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted">
            Commit
          </span>
        </div>
        <textarea
          className={clsx(
            'min-h-[68px] w-full resize-none rounded-control border border-border bg-surface-0 px-3 py-2 text-[12px] text-text-primary outline-none transition',
            'placeholder:text-text-faint focus:border-accent-muted focus:ring-1 focus:ring-accent-dim'
          )}
          onChange={(event) => onCommitMessageChange(event.target.value)}
          placeholder="Describe changes..."
          value={commitMessage}
        />

        <button
          className={clsx(
            'mt-2 flex w-full items-center justify-center rounded-control bg-accent px-3 py-2 text-[12px] font-semibold text-surface-0 transition',
            'hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50'
          )}
          disabled={isCommitting || changes.length === 0 || commitMessage.trim().length === 0}
          onClick={() => { void onCommit(); }}
          type="button"
        >
          {isCommitting ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : null}
          {isCommitting ? 'Committing...' : 'Commit changes'}
        </button>

        {commitNotice ? (
          <p className="mt-2 rounded-control border border-emerald-500/20 bg-emerald-500/[0.06] px-2.5 py-2 text-[12px] text-emerald-400">
            {commitNotice}
          </p>
        ) : null}

        {commitErrorMessage ? (
          <p className="mt-2 rounded-control border border-rose-500/20 bg-rose-500/[0.06] px-2.5 py-2 text-[12px] text-rose-400">
            {commitErrorMessage}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function ChangeStatusIndicator({ status }: { status: WorkspaceChange['status'] }) {
  const config: Record<WorkspaceChange['status'], { color: string; letter: string }> = {
    added: { color: 'text-emerald-400', letter: 'A' },
    deleted: { color: 'text-rose-400', letter: 'D' },
    modified: { color: 'text-sky-400', letter: 'M' },
    renamed: { color: 'text-violet-400', letter: 'R' },
    untracked: { color: 'text-amber-400', letter: 'U' }
  };

  const { color, letter } = config[status];

  return (
    <span className={clsx('shrink-0 font-mono text-[11px] font-bold', color)}>
      {letter}
    </span>
  );
}

function PanelMessage({ children, tone = 'subtle' }: { children: React.ReactNode; tone?: 'error' | 'subtle' }) {
  return (
    <p className={clsx(
      'px-2 py-2 text-[12px]',
      tone === 'error' ? 'text-rose-400' : 'text-text-faint'
    )}>
      {children}
    </p>
  );
}
