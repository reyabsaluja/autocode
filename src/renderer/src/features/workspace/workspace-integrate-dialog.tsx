import clsx from 'clsx';
import { ArrowDownToLine, GitBranch, Loader2, Sparkles } from 'lucide-react';

interface WorkspaceIntegrateDialogCandidate {
  branchName: string;
  taskId: number;
  title: string;
}

interface WorkspaceIntegrateDialogProps {
  baseLabel: string | null;
  errorMessage: string | null;
  isIntegratingBase: boolean;
  isMergingTaskId: number | null;
  isOpen: boolean;
  mergeCandidates: WorkspaceIntegrateDialogCandidate[];
  onClose: () => void;
  onIntegrateBase: () => void;
  onMergeTask: (taskId: number) => void;
  taskTitle: string;
}

export function WorkspaceIntegrateDialog({
  baseLabel,
  errorMessage,
  isIntegratingBase,
  isMergingTaskId,
  isOpen,
  mergeCandidates,
  onClose,
  onIntegrateBase,
  onMergeTask,
  taskTitle
}: WorkspaceIntegrateDialogProps) {
  if (!isOpen) {
    return null;
  }

  const hasOptions = Boolean(baseLabel) || mergeCandidates.length > 0;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-4 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg animate-slide-up rounded-xl border border-white/[0.10] bg-[#1c1c1c] p-5 shadow-2xl">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 shrink-0 text-sky-300" />
          <div className="min-w-0">
            <p className="font-geist text-[14px] font-semibold text-white/90">Integrate changes</p>
            <p className="mt-1 font-geist text-[12px] text-white/45">
              Bring newer work into <span className="text-white/70">{taskTitle}</span>.
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2">
          {baseLabel ? (
            <button
              className={clsx(
                'w-full rounded-lg border border-white/[0.10] bg-white/[0.04] px-4 py-3 text-left transition',
                'hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-50'
              )}
              disabled={isIntegratingBase || isMergingTaskId !== null}
              onClick={onIntegrateBase}
              type="button"
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 rounded-md bg-sky-500/[0.12] p-1.5 text-sky-200">
                  {isIntegratingBase ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ArrowDownToLine className="h-3.5 w-3.5" />
                  )}
                </span>
                <div className="min-w-0">
                  <p className="font-geist text-[13px] font-semibold text-white/85">
                    Bring in base changes
                  </p>
                  <p className="mt-1 font-geist text-[12px] leading-relaxed text-white/45">
                    Update this task with newer changes from <span className="text-white/70">{baseLabel}</span>.
                  </p>
                </div>
              </div>
            </button>
          ) : null}

          {mergeCandidates.length > 0 ? (
            <div className="rounded-lg border border-white/[0.10] bg-white/[0.03]">
              <div className="border-b border-white/[0.06] px-4 py-2">
                <p className="font-geist text-[11px] font-semibold uppercase tracking-[0.12em] text-white/45">
                  Use Changes From Another Task
                </p>
              </div>

              <div className="max-h-[240px] overflow-auto py-1">
                {mergeCandidates.map((candidate) => {
                  const isMerging = isMergingTaskId === candidate.taskId;

                  return (
                    <button
                      key={candidate.taskId}
                      className={clsx(
                        'flex w-full items-center gap-3 px-4 py-3 text-left transition',
                        'hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50'
                      )}
                      disabled={isIntegratingBase || isMergingTaskId !== null}
                      onClick={() => onMergeTask(candidate.taskId)}
                      type="button"
                    >
                      <span className="rounded-md bg-white/[0.06] p-1.5 text-white/45">
                        {isMerging ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <GitBranch className="h-3.5 w-3.5" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-geist text-[13px] font-medium text-white/82">
                          {candidate.title}
                        </p>
                        <p className="mt-0.5 truncate font-geist text-[12px] text-white/40">
                          Bring in the full committed branch from <span className="text-white/60">{candidate.branchName}</span>.
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

        {!hasOptions ? (
          <p className="mt-4 rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 font-geist text-[12px] text-white/45">
            This task does not have a base branch or any other task branches to integrate right now.
          </p>
        ) : null}

        {errorMessage ? (
          <p className="mt-4 rounded-md border border-rose-500/20 bg-rose-500/[0.06] px-3 py-2 font-geist text-[12px] text-rose-200">
            {errorMessage}
          </p>
        ) : null}

        <div className="mt-5 flex justify-end">
          <button
            className="flex items-center justify-center rounded-md px-4 py-2.5 font-geist text-[13px] font-medium text-white/35 transition hover:bg-white/[0.04] hover:text-white/55"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
