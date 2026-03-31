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
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-auto py-1">
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
          <ul>
            {changes.map((change) => {
              const isSelected = change.relativePath === selectedPath;

              return (
                <li key={`${change.status}:${change.relativePath}`}>
                  <button
                    className={clsx(
                      'flex w-full items-center gap-2.5 py-[6px] pl-3 pr-2 text-left font-geist transition',
                      isSelected
                        ? 'bg-white/[0.10] text-white'
                        : 'text-white/60 hover:bg-white/[0.06] hover:text-white/90'
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

      <div className="border-t border-white/[0.08] px-3 py-3">
        <div className="mb-2 flex items-center gap-1.5">
          <GitCommitHorizontal className="h-3 w-3 text-white/30" />
          <span className="font-geist text-[10px] font-semibold uppercase tracking-[0.12em] text-white/50">
            Commit
          </span>
        </div>
        <textarea
          className={clsx(
            'min-h-[60px] w-full resize-none rounded-md border border-white/[0.10] bg-black/[0.20] px-3 py-2 font-geist text-[12px] text-white outline-none transition',
            'placeholder:text-white/30 focus:border-white/[0.20] focus:ring-1 focus:ring-white/[0.06]'
          )}
          onChange={(event) => onCommitMessageChange(event.target.value)}
          placeholder="Commit message"
          value={commitMessage}
        />

        <button
          className={clsx(
            'mt-2 flex w-full items-center justify-center rounded-md bg-white px-3 py-2 font-geist text-[12px] font-semibold text-[#1c1c1c] transition',
            'hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50'
          )}
          disabled={isCommitting || changes.length === 0 || commitMessage.trim().length === 0}
          onClick={() => { void onCommit(); }}
          type="button"
        >
          {isCommitting ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : null}
          {isCommitting ? 'Committing...' : 'Commit'}
        </button>

        {commitNotice ? (
          <p className="mt-2 rounded-md border border-emerald-500/20 bg-emerald-500/[0.06] px-2.5 py-2 font-geist text-[12px] text-emerald-300">
            {commitNotice}
          </p>
        ) : null}

        {commitErrorMessage ? (
          <p className="mt-2 rounded-md border border-rose-500/20 bg-rose-500/[0.06] px-2.5 py-2 font-geist text-[12px] text-rose-300">
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
      'px-3 py-2 font-geist text-[12px]',
      tone === 'error' ? 'text-rose-300' : 'text-white/40'
    )}>
      {children}
    </p>
  );
}
