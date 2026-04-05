import { forwardRef, useDeferredValue, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { AlertTriangle, Check, ChevronDown, ChevronRight, FolderGit2, GitBranch, GitMerge, Loader2, Search } from 'lucide-react';

import type { Project } from '@shared/domain/project';
import type { TaskWorkspace } from '@shared/domain/task-workspace';

import type { WorkspaceEditorHandle } from '../editor/workspace-editor-surface';
import { UnsavedChangesDialog } from '../editor/unsaved-changes-dialog';
import { useUnsavedChangesGuard } from '../editor/use-unsaved-changes-guard';
import {
  useIntegrateBaseMutation,
  useMergeTaskIntoWorkspaceMutation,
  useUpdateBaseRefMutation,
  useWorkspaceBranchesQuery
} from '../workspace/workspace-hooks';
import { WorkspaceIntegrateDialog } from '../workspace/workspace-integrate-dialog';
import {
  EXTERNAL_EDITORS,
  EXTERNAL_EDITOR_ICON_SRC,
  EXTERNAL_EDITOR_LABELS,
  type ExternalEditor
} from '../../lib/editor-icon-assets';
import { autocodeApi } from '../../lib/autocode-api';
import { useOpenInEditorStore } from '../../stores/open-in-editor-store';

type WorkspaceInspectorComponent = typeof import('../workspace/workspace-inspector')['WorkspaceInspector'];

interface WorkspaceDetailsProps {
  isForkingTask: boolean;
  isSidebarOpen: boolean;
  isLoadingTasks: boolean;
  onForkTaskWorkspace: () => Promise<unknown>;
  onRequestTaskSelection: (taskId: number) => void;
  project: Project | null;
  taskWorkspace: TaskWorkspace | null;
  taskWorkspaces: TaskWorkspace[];
}

export const WorkspaceDetails = forwardRef<WorkspaceEditorHandle, WorkspaceDetailsProps>(function WorkspaceDetails({
  isForkingTask,
  isSidebarOpen,
  isLoadingTasks,
  onForkTaskWorkspace,
  onRequestTaskSelection,
  project,
  taskWorkspace,
  taskWorkspaces
}, ref) {
  const editorRef = useRef<WorkspaceEditorHandle | null>(null);
  const [WorkspaceInspectorComponent, setWorkspaceInspectorComponent] =
    useState<WorkspaceInspectorComponent | null>(null);
  const [isIntegrateDialogOpen, setIsIntegrateDialogOpen] = useState(false);
  const [integrationNotice, setIntegrationNotice] = useState<string | null>(null);
  const { dialogProps, requestTransition } = useUnsavedChangesGuard(editorRef);
  const taskId = taskWorkspace?.task.id ?? null;
  const integrateBaseMutation = useIntegrateBaseMutation(taskId);
  const mergeTaskMutation = useMergeTaskIntoWorkspaceMutation(taskId);
  const updateBaseRefMutation = useUpdateBaseRefMutation(taskId);
  const branchesQuery = useWorkspaceBranchesQuery(taskId);
  const currentTask = taskWorkspace?.task ?? null;
  const currentWorktree = taskWorkspace?.worktree ?? null;
  const currentBranchLabel = currentWorktree
    ? formatWorkspaceBranchLabel(currentWorktree.branchName)
    : null;
  const baseRef = currentWorktree?.baseRef ?? project?.defaultBranch ?? null;
  const [isBranchPickerOpen, setIsBranchPickerOpen] = useState(false);
  const baseTaskWorkspace = useMemo(
    () =>
      baseRef && currentTask
        ? taskWorkspaces.find(
            (workspace) =>
              workspace.task.id !== currentTask.id &&
              workspace.worktree?.branchName === baseRef
          ) ?? null
        : null,
    [baseRef, currentTask, taskWorkspaces]
  );
  const baseLabel = baseTaskWorkspace?.task.title ?? baseRef;
  const integrationCandidates = useMemo(() => {
    if (!currentTask) return [];

    const candidates: Array<{ branchName: string; taskId: number; title: string }> = [];

    for (const workspace of taskWorkspaces) {
      if (workspace.task.id !== currentTask.id && workspace.worktree !== null) {
        candidates.push({
          branchName: workspace.worktree.branchName,
          taskId: workspace.task.id,
          title: workspace.task.title
        });
      }
    }

    return candidates;
  }, [currentTask, taskWorkspaces]);
  const canIntegrate = Boolean(baseLabel) || integrationCandidates.length > 0;
  const integrationErrorMessage =
    (integrateBaseMutation.error instanceof Error ? integrateBaseMutation.error.message : null) ??
    (mergeTaskMutation.error instanceof Error ? mergeTaskMutation.error.message : null);

  useImperativeHandle(
    ref,
    () => ({
      discardUnsavedChanges: () => editorRef.current?.discardUnsavedChanges(),
      getActiveFilePath: () => editorRef.current?.getActiveFilePath() ?? null,
      hasUnsavedChanges: () => editorRef.current?.hasUnsavedChanges() ?? false,
      saveActiveFile: async () => (await editorRef.current?.saveActiveFile()) ?? false
    }),
    []
  );

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

  useEffect(() => {
    setIsIntegrateDialogOpen(false);
    setIsBranchPickerOpen(false);
    setIntegrationNotice(null);
    integrateBaseMutation.reset();
    mergeTaskMutation.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mutation objects are intentionally excluded to avoid reset loops from new references.
  }, [taskId]);

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

  function requestIntegrationAction(key: string, run: () => void) {
    requestTransition({
      body: `Save or discard your changes to ${
        editorRef.current?.getActiveFilePath() ?? 'the current file'
      } before integrating branches in this workspace.`,
      key,
      run,
      title: 'Unsaved workspace edits'
    });
  }

  function handleIntegrateBase() {
    requestIntegrationAction(`integrate-base:${task.id}`, () => {
      void integrateBaseMutation.mutateAsync().then((result) => {
        setIntegrationNotice(result.message);
        setIsIntegrateDialogOpen(false);
      }).catch(() => {
        // The dialog renders the current integration error.
      });
    });
  }

  function handleMergeTask(sourceTaskId: number) {
    requestIntegrationAction(`integrate-task:${task.id}:${sourceTaskId}`, () => {
      void mergeTaskMutation.mutateAsync(sourceTaskId).then((result) => {
        setIntegrationNotice(result.message);
        setIsIntegrateDialogOpen(false);
      }).catch(() => {
        // The dialog renders the current integration error.
      });
    });
  }

  return (
    <section className="flex h-full flex-col animate-fade-in">
      <header className={clsx(
        'grid h-[38px] shrink-0 grid-cols-[minmax(0,1fr)_300px] border-b border-white/[0.06] bg-[#141414]',
        isSidebarOpen ? '' : 'pl-[100px]'
      )}>
        <div className="flex items-center gap-1.5 pl-4 pr-2">
          {worktree ? <GitBranch className="h-3.5 w-3.5 shrink-0 text-white" /> : null}
          <p className="min-w-0 truncate font-geist text-[13px] font-semibold text-white/90">
            {currentBranchLabel ?? task.title}
          </p>
          {baseRef ? (
            <>
              <ChevronRight className="h-3 w-3 shrink-0 text-white ml-1" />
              <div className="relative">
                <button
                  className="flex items-center gap-1 rounded px-1.5 py-0.5 font-geist text-[13px] text-white transition hover:bg-white/[0.08] hover:text-white/80"
                  onClick={() => setIsBranchPickerOpen((open) => !open)}
                  type="button"
                >
                  {baseLabel ?? baseRef}
                  <ChevronDown className="h-3 w-3 text-white" />
                </button>
                {isBranchPickerOpen ? (
                  <BranchPicker
                    branches={branchesQuery.data ?? []}
                    currentBaseRef={baseRef}
                    isLoading={branchesQuery.isLoading}
                    onClose={() => setIsBranchPickerOpen(false)}
                    onSelect={(branch) => {
                      updateBaseRefMutation.mutate(branch);
                      setIsBranchPickerOpen(false);
                    }}
                  />
                ) : null}
              </div>
            </>
          ) : null}

          <div className="ml-auto flex shrink-0 items-center gap-2 pl-4">
            <button
              aria-label="Create an isolated task branch"
              className="inline-flex h-7 w-7 items-center justify-center rounded bg-white/[0.08] text-white/60 transition hover:bg-white/[0.12] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isForkingTask}
              onClick={() => { void onForkTaskWorkspace(); }}
              title="Create a new isolated task workspace from this task's current branch"
              type="button"
            >
              {isForkingTask ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <GitBranch className="h-3.5 w-3.5" />
              )}
            </button>
            <button
              className="inline-flex h-7 items-center gap-1.5 rounded bg-white/[0.08] px-2.5 font-geist text-[12px] font-medium text-white/60 transition hover:bg-white/[0.12] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!canIntegrate || integrateBaseMutation.isPending || mergeTaskMutation.isPending}
              onClick={() => {
                setIntegrationNotice(null);
                setIsIntegrateDialogOpen(true);
              }}
              title={canIntegrate ? 'Integrate base or task changes into this workspace' : 'No branches are available to integrate into this task'}
              type="button"
            >
              {integrateBaseMutation.isPending || mergeTaskMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <GitMerge className="h-3.5 w-3.5" />
              )}
              Integrate
            </button>
            <OpenInEditorButton worktreePath={worktree?.worktreePath ?? null} />
          </div>
        </div>
        <div />
      </header>

      {integrationNotice ? (
        <div className="flex items-center gap-2 border-b border-emerald-500/15 bg-emerald-500/[0.05] px-4 py-2 font-geist text-[12px] text-emerald-200">
          <GitMerge className="h-3.5 w-3.5 shrink-0" />
          {integrationNotice}
        </div>
      ) : null}

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
            onRequestTaskSelection={onRequestTaskSelection}
            ref={editorRef}
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

      <WorkspaceIntegrateDialog
        baseLabel={baseLabel}
        errorMessage={integrationErrorMessage}
        isIntegratingBase={integrateBaseMutation.isPending}
        isMergingTaskId={mergeTaskMutation.isPending ? mergeTaskMutation.variables ?? null : null}
        isOpen={isIntegrateDialogOpen}
        mergeCandidates={integrationCandidates}
        onClose={() => setIsIntegrateDialogOpen(false)}
        onIntegrateBase={handleIntegrateBase}
        onMergeTask={handleMergeTask}
        taskTitle={task.title}
      />

      <UnsavedChangesDialog
        {...dialogProps}
        title="Unsaved workspace edits"
      />
    </section>
  );
});

function OpenInEditorButton({ worktreePath }: { worktreePath: string | null }) {
  const preferredEditor = useOpenInEditorStore((state) => state.preferredEditor);
  const setPreferredEditor = useOpenInEditorStore((state) => state.setPreferredEditor);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  function handleOpen(editor: ExternalEditor) {
    setPreferredEditor(editor);
    setIsOpen(false);

    if (worktreePath) {
      void autocodeApi.workspaces.openInEditor({ editor, worktreePath });
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        className="inline-flex h-7 items-center gap-1.5 rounded bg-white/[0.08] pl-2 pr-1.5 font-geist text-[12px] font-medium text-white/60 transition hover:bg-white/[0.12] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
        disabled={!worktreePath}
        onClick={() => handleOpen(preferredEditor)}
        title={`Open in ${EXTERNAL_EDITOR_LABELS[preferredEditor]}`}
        type="button"
      >
        <img
          alt=""
          className="h-3.5 w-3.5 shrink-0 object-contain"
          draggable={false}
          src={EXTERNAL_EDITOR_ICON_SRC[preferredEditor]}
        />
        Open
        <button
          className="ml-0.5 grid h-5 w-5 shrink-0 place-items-center rounded transition hover:bg-white/[0.10]"
          onClick={(event) => {
            event.stopPropagation();
            setIsOpen((open) => !open);
          }}
          type="button"
        >
          <ChevronDown className="h-3 w-3" />
        </button>
      </button>

      {isOpen ? (
        <div className="absolute right-0 top-full z-50 mt-1 w-40 overflow-hidden rounded-lg border border-white/[0.10] bg-[#1c1c1c] shadow-2xl">
          <div className="py-1">
            {EXTERNAL_EDITORS.map((editor) => (
              <button
                key={editor}
                className={clsx(
                  'flex w-full items-center gap-2.5 px-3 py-1.5 text-left transition hover:bg-white/[0.06]',
                  editor === preferredEditor ? 'bg-white/[0.04]' : ''
                )}
                onClick={() => handleOpen(editor)}
                type="button"
              >
                <img
                  alt=""
                  className="h-3.5 w-3.5 shrink-0 object-contain"
                  draggable={false}
                  src={EXTERNAL_EDITOR_ICON_SRC[editor]}
                />
                <span className="font-geist text-[12px] font-medium text-white/70">
                  {EXTERNAL_EDITOR_LABELS[editor]}
                </span>
                {editor === preferredEditor ? (
                  <Check className="ml-auto h-3 w-3 text-white/50" />
                ) : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function formatWorkspaceBranchLabel(branchName: string): string {
  return branchName.replace(/^autocode\/(?:task-\d+-)?/, 'autocode/');
}

interface BranchPickerProps {
  branches: string[];
  currentBaseRef: string;
  isLoading: boolean;
  onClose: () => void;
  onSelect: (branch: string) => void;
}

function BranchPicker({ branches, currentBaseRef, isLoading, onClose, onSelect }: BranchPickerProps) {
  const [filter, setFilter] = useState('');
  const deferredFilter = useDeferredValue(filter);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const filtered = useMemo(() => {
    if (!deferredFilter) return branches;
    const lower = deferredFilter.toLowerCase();
    return branches.filter((b) => b.toLowerCase().includes(lower));
  }, [branches, deferredFilter]);

  return (
    <div
      ref={dropdownRef}
      className="absolute left-0 top-full z-50 mt-1 w-64 overflow-hidden rounded-lg border border-white/[0.10] bg-[#1c1c1c] shadow-2xl"
    >
      <div className="flex items-center gap-2 border-b border-white/[0.06] px-3 py-2">
        <Search className="h-3.5 w-3.5 shrink-0 text-white/30" />
        <input
          ref={inputRef}
          className="flex-1 bg-transparent font-geist text-[13px] text-white/80 placeholder-white/30 outline-none"
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Switch base branch\u2026"
          type="text"
          value={filter}
        />
      </div>
      <div className="max-h-[240px] overflow-auto py-1">
        {isLoading ? (
          <div className="flex items-center gap-2 px-3 py-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-white/30" />
            <span className="font-geist text-[12px] text-white/30">Loading branches\u2026</span>
          </div>
        ) : filtered.length === 0 ? (
          <p className="px-3 py-2 font-geist text-[12px] text-white/30">No branches found</p>
        ) : (
          filtered.map((branch) => {
            const isActive = branch === currentBaseRef;

            return (
              <button
                key={branch}
                className={clsx(
                  'flex w-full items-center gap-2 px-3 py-1.5 text-left transition',
                  isActive ? 'bg-white/[0.04]' : 'hover:bg-white/[0.06]'
                )}
                onClick={() => onSelect(branch)}
                type="button"
              >
                <span className="w-4 shrink-0">
                  {isActive ? <Check className="h-3.5 w-3.5 text-white/60" /> : null}
                </span>
                <span className="min-w-0 truncate font-geist text-[13px] text-white/70">
                  {branch}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
