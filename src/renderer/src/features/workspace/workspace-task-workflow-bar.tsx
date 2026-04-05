import { type ReactNode, useMemo } from 'react';
import clsx from 'clsx';
import {
  Bot,
  CheckCheck,
  Eye,
  FolderArchive,
  GitCommitHorizontal,
  GitCompare,
  Loader2,
  Play,
  RotateCcw
} from 'lucide-react';

import type { AgentSession } from '@shared/domain/agent-session';
import {
  formatTaskStatus,
  getTaskTransitionActionLabel,
  getTaskTransitionTargets,
  type TaskStatus,
  type TaskTransitionTarget
} from '@shared/domain/task';
import type { TaskWorkspace } from '@shared/domain/task-workspace';

import { getProviderDisplayName, isActiveSessionStatus } from './workspace-inspector-shared';

interface WorkspaceTaskWorkflowBarProps {
  changesCount: number;
  commitsCount: number;
  isUpdatingStatus: boolean;
  onUpdateStatus: (status: TaskTransitionTarget) => void;
  sessions: AgentSession[];
  statusErrorMessage: string | null;
  taskWorkspace: TaskWorkspace;
}

const TRANSITION_PRIORITY: Record<TaskTransitionTarget, number> = {
  archived: 4,
  completed: 3,
  in_progress: 0,
  needs_review: 1,
  ready: 2
};

const STATUS_BADGE_STYLES: Record<TaskStatus, string> = {
  archived: 'border-white/[0.10] bg-white/[0.08] text-white/55',
  completed: 'border-emerald-500/20 bg-emerald-500/[0.10] text-emerald-200',
  draft: 'border-amber-500/20 bg-amber-500/[0.10] text-amber-200',
  failed: 'border-rose-500/20 bg-rose-500/[0.10] text-rose-200',
  in_progress: 'border-sky-500/20 bg-sky-500/[0.10] text-sky-200',
  needs_review: 'border-violet-500/20 bg-violet-500/[0.10] text-violet-200',
  ready: 'border-white/[0.10] bg-white/[0.05] text-white/75'
};

export function WorkspaceTaskWorkflowBar({
  changesCount,
  commitsCount,
  isUpdatingStatus,
  onUpdateStatus,
  sessions,
  statusErrorMessage,
  taskWorkspace
}: WorkspaceTaskWorkflowBarProps) {
  const task = taskWorkspace.task;
  const activeSession = sessions.find((session) => isActiveSessionStatus(session.status)) ?? null;
  const latestSession = sessions[0] ?? null;
  const transitions = useMemo(
    () => getTaskTransitionTargets(task.status)
      .slice()
      .sort((left, right) => TRANSITION_PRIORITY[left] - TRANSITION_PRIORITY[right]),
    [task.status]
  );
  const statusConstraintMessage = activeSession
    ? `Finish the active ${getProviderDisplayName(activeSession.provider)} run before moving this task forward.`
    : changesCount > 0
      ? 'Commit or discard workspace changes before completing or archiving this task.'
      : null;

  return (
    <div className="border-b border-white/[0.06] bg-[#111111] px-4 py-3">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={clsx(
              'rounded-full border px-2 py-1 font-geist text-[11px] font-semibold uppercase tracking-[0.12em]',
              STATUS_BADGE_STYLES[task.status]
            )}>
              {formatTaskStatus(task.status)}
            </span>
            <span className="font-geist text-[12px] text-white/45">
              Explicit lifecycle controls for this workspace.
            </span>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <SummaryPill
              icon={<GitCompare className="h-3.5 w-3.5" />}
              label={`${changesCount} ${changesCount === 1 ? 'changed file' : 'changed files'}`}
            />
            <SummaryPill
              icon={<GitCommitHorizontal className="h-3.5 w-3.5" />}
              label={`${commitsCount} ${commitsCount === 1 ? 'recent commit' : 'recent commits'}`}
            />
            <SummaryPill
              icon={<Bot className="h-3.5 w-3.5" />}
              label={formatRunSummary(activeSession, latestSession)}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {transitions.map((status) => {
            const disabledReason = getDisabledReason(status, Boolean(activeSession), changesCount);

            return (
              <button
                key={status}
                className={clsx(
                  'inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 font-geist text-[12px] font-medium transition',
                  disabledReason || isUpdatingStatus
                    ? 'cursor-not-allowed border-white/[0.08] bg-white/[0.04] text-white/25'
                    : getTransitionButtonStyles(status)
                )}
                disabled={Boolean(disabledReason) || isUpdatingStatus}
                onClick={() => onUpdateStatus(status)}
                title={disabledReason ?? getTaskTransitionActionLabel(task.status, status)}
                type="button"
              >
                {isUpdatingStatus ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <TransitionIcon status={status} />
                )}
                {getTaskTransitionActionLabel(task.status, status)}
              </button>
            );
          })}
        </div>
      </div>

      {statusConstraintMessage ? (
        <p className="mt-3 font-geist text-[12px] text-white/40">{statusConstraintMessage}</p>
      ) : null}

      {statusErrorMessage ? (
        <p className="mt-3 rounded-md border border-rose-500/20 bg-rose-500/[0.06] px-3 py-2 font-geist text-[12px] text-rose-200">
          {statusErrorMessage}
        </p>
      ) : null}
    </div>
  );
}

function SummaryPill({
  icon,
  label
}: {
  icon: ReactNode;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 font-geist text-[11px] text-white/60">
      <span className="text-white/35">{icon}</span>
      <span>{label}</span>
    </span>
  );
}

function TransitionIcon({ status }: { status: TaskTransitionTarget }) {
  switch (status) {
    case 'ready':
      return <RotateCcw className="h-3.5 w-3.5" />;
    case 'in_progress':
      return <Play className="h-3.5 w-3.5" />;
    case 'needs_review':
      return <Eye className="h-3.5 w-3.5" />;
    case 'completed':
      return <CheckCheck className="h-3.5 w-3.5" />;
    case 'archived':
      return <FolderArchive className="h-3.5 w-3.5" />;
  }
}

function formatRunSummary(
  activeSession: AgentSession | null,
  latestSession: AgentSession | null
): string {
  if (activeSession) {
    return `${getProviderDisplayName(activeSession.provider)} running now`;
  }

  if (latestSession) {
    return `Last run ${latestSession.status.replaceAll('_', ' ')}`;
  }

  return 'No runs yet';
}

function getDisabledReason(
  status: TaskTransitionTarget,
  hasActiveSession: boolean,
  changesCount: number
): string | null {
  if (hasActiveSession && status !== 'in_progress') {
    return 'Wait for the active run to finish first.';
  }

  if ((status === 'completed' || status === 'archived') && changesCount > 0) {
    return 'Commit or discard workspace changes first.';
  }

  return null;
}

function getTransitionButtonStyles(status: TaskTransitionTarget): string {
  switch (status) {
    case 'ready':
      return 'border-white/[0.10] bg-white/[0.05] text-white/75 hover:bg-white/[0.10] hover:text-white';
    case 'in_progress':
      return 'border-sky-500/25 bg-sky-500/[0.10] text-sky-100 hover:bg-sky-500/[0.16]';
    case 'needs_review':
      return 'border-violet-500/25 bg-violet-500/[0.10] text-violet-100 hover:bg-violet-500/[0.16]';
    case 'completed':
      return 'border-emerald-500/25 bg-emerald-500/[0.10] text-emerald-100 hover:bg-emerald-500/[0.16]';
    case 'archived':
      return 'border-white/[0.10] bg-white/[0.04] text-white/70 hover:bg-white/[0.10] hover:text-white';
  }
}
