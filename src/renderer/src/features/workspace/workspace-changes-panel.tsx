import { useState } from 'react';
import clsx from 'clsx';
import { ChevronDown, ChevronRight, GitCommitHorizontal, Loader2, Plus } from 'lucide-react';

import type { WorkspaceChange, WorkspaceCommitLogEntry } from '@shared/domain/workspace-inspection';

interface WorkspaceChangesPanelProps {
  changes: WorkspaceChange[];
  commitErrorMessage: string | null;
  commitMessage: string;
  commitNotice: string | null;
  commits: WorkspaceCommitLogEntry[];
  commitsLoadErrorMessage: string | null;
  isCommitting: boolean;
  isLoading: boolean;
  isLoadingCommits: boolean;
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
  commits,
  commitsLoadErrorMessage,
  isCommitting,
  isLoading,
  isLoadingCommits,
  loadErrorMessage,
  onCommit,
  onCommitMessageChange,
  onSelectChange,
  selectedPath
}: WorkspaceChangesPanelProps) {
  const [isUnstagedOpen, setIsUnstagedOpen] = useState(true);
  const [isAgainstMainOpen, setIsAgainstMainOpen] = useState(true);
  const [isCommitsOpen, setIsCommitsOpen] = useState(true);

  const unstaged = changes.filter((c) => !c.isStaged);
  const allChanges = changes;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-auto">
        {isLoading ? (
          <PanelMessage>
            <Loader2 className="mr-1.5 inline h-3 w-3 animate-spin" />
            Checking changes
          </PanelMessage>
        ) : null}

        {loadErrorMessage ? (
          <PanelMessage tone="error">{loadErrorMessage}</PanelMessage>
        ) : null}

        {!isLoading && !loadErrorMessage ? (
          <>
            <SectionHeader
              count={unstaged.length}
              isOpen={isUnstagedOpen}
              label="Unstaged"
              onToggle={() => setIsUnstagedOpen((c) => !c)}
              trailing={
                unstaged.length > 0 ? (
                  <button
                    className="grid h-5 w-5 place-items-center rounded text-white/30 transition hover:bg-white/[0.08] hover:text-white/60"
                    title="Stage all (happens automatically on commit)"
                    type="button"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                ) : null
              }
            />
            {isUnstagedOpen ? (
              unstaged.length > 0 ? (
                <ChangeFileList
                  changes={unstaged}
                  onSelectChange={onSelectChange}
                  selectedPath={selectedPath}
                />
              ) : (
                <PanelMessage>No unstaged changes.</PanelMessage>
              )
            ) : null}

            <SectionHeader
              count={allChanges.length}
              isOpen={isAgainstMainOpen}
              label="Against main"
              onToggle={() => setIsAgainstMainOpen((c) => !c)}
            />
            {isAgainstMainOpen ? (
              allChanges.length > 0 ? (
                <ChangeFileList
                  changes={allChanges}
                  onSelectChange={onSelectChange}
                  selectedPath={selectedPath}
                />
              ) : (
                <PanelMessage>Clean — no changes against main.</PanelMessage>
              )
            ) : null}

            <SectionHeader
              count={commits.length}
              isOpen={isCommitsOpen}
              label="Commits"
              onToggle={() => setIsCommitsOpen((c) => !c)}
            />
            {isCommitsOpen ? (
              isLoadingCommits ? (
                <PanelMessage>
                  <Loader2 className="mr-1.5 inline h-3 w-3 animate-spin" />
                  Loading commits
                </PanelMessage>
              ) : commitsLoadErrorMessage ? (
                <PanelMessage tone="error">{commitsLoadErrorMessage}</PanelMessage>
              ) : commits.length > 0 ? (
                <ul className="py-0.5">
                  {commits.map((entry) => (
                    <li
                      key={entry.sha}
                      className="flex items-baseline gap-2 px-3 py-[5px] font-geist text-[12px]"
                    >
                      <span className="shrink-0 font-mono text-[11px] text-white/25">
                        {entry.sha.slice(0, 8)}
                      </span>
                      <span className="min-w-0 truncate text-white/55">
                        {entry.message}
                      </span>
                      <span className="ml-auto shrink-0 text-[10px] text-white/20">
                        {entry.relativeTime}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <PanelMessage>No commits on this branch yet.</PanelMessage>
              )
            ) : null}
          </>
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

function SectionHeader({
  count,
  isOpen,
  label,
  onToggle,
  trailing
}: {
  count: number;
  isOpen: boolean;
  label: string;
  onToggle: () => void;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1 px-3 py-1.5">
      <button
        className="flex min-w-0 items-center gap-1.5 text-left"
        onMouseDown={(event) => {
          event.preventDefault();
          onToggle();
        }}
        type="button"
      >
        {isOpen ? (
          <ChevronDown className="h-3 w-3 shrink-0 text-white/30" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0 text-white/30" />
        )}
        <span className="font-geist text-[11px] font-semibold text-white/60">{label}</span>
        <span className="font-geist text-[11px] text-white/25">{count}</span>
      </button>
      {trailing ? <div className="ml-auto">{trailing}</div> : null}
    </div>
  );
}

function ChangeFileList({
  changes,
  onSelectChange,
  selectedPath
}: {
  changes: WorkspaceChange[];
  onSelectChange: (path: string) => void;
  selectedPath: string | null;
}) {
  return (
    <ul className="py-0.5">
      {changes.map((change) => {
        const isSelected = change.relativePath === selectedPath;
        const fileName = change.relativePath.split('/').at(-1) ?? change.relativePath;
        const dirPath = change.relativePath.includes('/')
          ? change.relativePath.slice(0, change.relativePath.lastIndexOf('/'))
          : null;

        return (
          <li key={`${change.status}:${change.relativePath}`}>
            <button
              className={clsx(
                'group flex w-full items-center gap-2 py-[5px] pl-6 pr-2 text-left font-geist transition',
                isSelected
                  ? 'bg-white/[0.10] text-white'
                  : 'text-white/60 hover:bg-white/[0.06] hover:text-white/90'
              )}
              onMouseDown={(event) => {
                event.preventDefault();
                onSelectChange(change.relativePath);
              }}
              type="button"
            >
              <ChangeStatusIndicator status={change.status} />
              <span className="min-w-0 truncate text-[12px]">{fileName}</span>
              {dirPath ? (
                <span className="min-w-0 truncate text-[10px] text-white/20">{dirPath}</span>
              ) : null}
              <span className="ml-auto flex shrink-0 items-center gap-1 font-mono text-[10px]">
                {change.linesAdded != null && change.linesAdded > 0 ? (
                  <span className="text-emerald-400">+{change.linesAdded}</span>
                ) : null}
                {change.linesRemoved != null && change.linesRemoved > 0 ? (
                  <span className="text-rose-400">-{change.linesRemoved}</span>
                ) : null}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
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
      tone === 'error' ? 'text-rose-300' : 'text-white/30'
    )}>
      {children}
    </p>
  );
}
