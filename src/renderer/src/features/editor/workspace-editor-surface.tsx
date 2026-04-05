import { Suspense, forwardRef, lazy, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import clsx from 'clsx';
import { AlertTriangle, FileCode, Loader2, Minus, Plus, Save, Undo2 } from 'lucide-react';

import type { WorkspaceChange } from '@shared/domain/workspace-inspection';

import { autocodeEditorTheme } from '../../lib/editor-theme';
import { WorkspaceDiffViewer } from '../workspace/workspace-diff-viewer';
import { useWorkspaceDiffQuery } from '../workspace/workspace-hooks';
import { useWorkspaceLanguageSupport } from './editor-language';
import { useWorkspaceFileQuery, useWriteWorkspaceFileMutation } from './editor-hooks';
import {
  resolveLatestWorkspaceFileContent,
  resolveWorkspaceEditorSyncState
} from './workspace-editor-sync';

const LazyCodeMirror = lazy(() => import('@uiw/react-codemirror'));

const CODEMIRROR_BASIC_SETUP = {
  foldGutter: false,
  highlightActiveLineGutter: true
} as const;

export interface WorkspaceEditorHandle {
  discardUnsavedChanges: () => void;
  getActiveFilePath: () => string | null;
  hasUnsavedChanges: () => boolean;
  saveActiveFile: () => Promise<boolean>;
}

interface WorkspaceEditorSurfaceProps {
  activeChange: WorkspaceChange | null;
  activeFilePath: string | null;
  mode: 'diff' | 'editor';
  onModeChange: (mode: 'diff' | 'editor') => void;
  taskId: number;
}

export const WorkspaceEditorSurface = forwardRef<WorkspaceEditorHandle, WorkspaceEditorSurfaceProps>(
  function WorkspaceEditorSurface({ activeChange, activeFilePath, mode, onModeChange, taskId }, ref) {
    const shouldLoadFile = mode === 'editor';
    const shouldLoadDiff = mode === 'diff' && activeFilePath !== null;
    const fileQuery = useWorkspaceFileQuery(taskId, activeFilePath, shouldLoadFile);
    const diffQuery = useWorkspaceDiffQuery(taskId, activeFilePath, activeChange, shouldLoadDiff);
    const writeFileMutation = useWriteWorkspaceFileMutation(taskId, activeFilePath);
    const [bufferContent, setBufferContent] = useState('');
    const [lastSavedContent, setLastSavedContent] = useState('');
    const [loadedIdentity, setLoadedIdentity] = useState<string | null>(null);
    const [saveNotice, setSaveNotice] = useState<string | null>(null);
    const activeIdentity = activeFilePath ? `${taskId}:${activeFilePath}` : null;
    const isDirty = bufferContent !== lastSavedContent;
    const latestFileContent = fileQuery.data?.content ?? '';
    const fileSyncState = resolveWorkspaceEditorSyncState({
      bufferContent,
      isDirty,
      lastSavedContent,
      latestContent: latestFileContent
    });
    const hasExternalFileConflict =
      shouldLoadFile &&
      loadedIdentity === activeIdentity &&
      Boolean(fileQuery.data) &&
      !fileQuery.data?.isBinary &&
      fileSyncState.hasExternalConflict;
    const languageExtensions = useWorkspaceLanguageSupport(activeFilePath);
    const diffLineSummary = useMemo(() => {
      if (mode !== 'diff' || !diffQuery.data?.text) {
        return null;
      }

      return parseDiffMetadata(diffQuery.data.text);
    }, [diffQuery.data?.text, mode]);

    useEffect(() => {
      setBufferContent('');
      setLastSavedContent('');
      setSaveNotice(null);
      writeFileMutation.reset();

      if (!activeIdentity) {
        setLoadedIdentity(null);
      }
    }, [activeIdentity]);

    useEffect(() => {
      if (!activeIdentity) {
        setBufferContent('');
        setLastSavedContent('');
        setLoadedIdentity(null);
        setSaveNotice(null);
        return;
      }

      if (!shouldLoadFile || !fileQuery.data) {
        return;
      }

      const nextContent = fileQuery.data.content ?? '';
      const shouldResetBuffer = loadedIdentity !== activeIdentity || !isDirty;

      if (!shouldResetBuffer) {
        if (resolveWorkspaceEditorSyncState({
          bufferContent,
          isDirty,
          lastSavedContent,
          latestContent: nextContent
        }).didDiskCatchUp) {
          setLastSavedContent(nextContent);
          setLoadedIdentity(activeIdentity);
          setSaveNotice(null);
        }

        return;
      }

      setBufferContent(nextContent);
      setLastSavedContent(nextContent);
      setLoadedIdentity(activeIdentity);
      setSaveNotice(null);
    }, [activeIdentity, bufferContent, fileQuery.data, isDirty, lastSavedContent, loadedIdentity, shouldLoadFile]);

    useEffect(() => {
      const handleBeforeUnload = (event: BeforeUnloadEvent) => {
        if (!isDirty) {
          return;
        }

        event.preventDefault();
        event.returnValue = '';
      };

      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [isDirty]);

    useImperativeHandle(
      ref,
      () => ({
        discardUnsavedChanges: () => {
          const latestContent = resolveLatestWorkspaceFileContent(fileQuery.data?.content, lastSavedContent);
          setBufferContent(latestContent);
          setLastSavedContent(latestContent);
          setSaveNotice(null);
          writeFileMutation.reset();
        },
        getActiveFilePath: () => activeFilePath,
        hasUnsavedChanges: () => isDirty,
        saveActiveFile: () => persistFile()
      }),
      [activeFilePath, bufferContent, fileQuery.data?.content, fileQuery.data?.isBinary, hasExternalFileConflict, isDirty, lastSavedContent, writeFileMutation]
    );

    const persistFile = async () => {
      if (!activeFilePath || fileQuery.data?.isBinary || hasExternalFileConflict) {
        return false;
      }

      try {
        const result = await writeFileMutation.mutateAsync({
          content: bufferContent,
          expectedContent: lastSavedContent
        });
        setLastSavedContent(bufferContent);
        setSaveNotice(`Saved ${basename(result.relativePath)}.`);
        return true;
      } catch {
        return false;
      }
    };

    const isBinary = shouldLoadFile && Boolean(fileQuery.data?.isBinary);
    const loadErrorMessage = shouldLoadFile ? formatError(fileQuery.error) : null;
    const saveErrorMessage = formatError(writeFileMutation.error);
    const editorTitle = activeFilePath ? basename(activeFilePath) : 'Editor';

    return (
      <div className="flex h-full min-h-0 flex-col overflow-hidden border-r border-white/[0.06] bg-[#101010]">
        <div className="flex items-center justify-between border-b border-white/[0.06] bg-[#141414] px-4 py-1.5">
          <div className="flex min-w-0 items-center gap-2">
            <FileCode className="h-3.5 w-3.5 shrink-0 text-white/30" />
            <p className="truncate font-geist text-[12px] font-medium text-white/80">{editorTitle}</p>
            {isDirty ? <StateBadge tone="dirty" value="Unsaved" /> : null}
            {activeChange ? (
              <StateBadge
                tone="modified"
                value={formatWorkspaceChangeLabel(activeChange.status)}
              />
            ) : null}
            {activeFilePath ? (
              <span className="truncate font-geist text-[11px] text-white/25">{activeFilePath}</span>
            ) : null}
            {diffLineSummary ? (
              <span className="flex items-center gap-1.5 font-geist text-[11px]">
                <span className="text-emerald-400">+{diffLineSummary.addedLinesCount}</span>
                <span className="text-rose-400">-{diffLineSummary.removedLinesCount}</span>
              </span>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-1 pl-3">
            <ModeToggle
              isActive={mode === 'editor'}
              label="Edit"
              onClick={() => onModeChange('editor')}
            />
            <ModeToggle
              isActive={mode === 'diff'}
              label="Diff"
              onClick={() => onModeChange('diff')}
            />
            <div className="mx-1 h-4 w-px bg-white/[0.08]" />
            <button
              className={clsx(
                'flex items-center gap-1 rounded-md px-2 py-1 font-geist text-[11px] font-medium transition',
                'text-white/40 hover:bg-white/[0.06] hover:text-white/70',
                'disabled:cursor-not-allowed disabled:opacity-40'
              )}
              disabled={!activeFilePath || !isDirty}
              onClick={() => {
                const latestContent = resolveLatestWorkspaceFileContent(fileQuery.data?.content, lastSavedContent);
                setBufferContent(latestContent);
                setLastSavedContent(latestContent);
                setSaveNotice(null);
                writeFileMutation.reset();
              }}
              title={hasExternalFileConflict ? 'Reload from disk' : 'Discard changes'}
              type="button"
            >
              <Undo2 className="h-3 w-3" />
              {hasExternalFileConflict ? 'Reload' : 'Discard'}
            </button>
            <button
              className={clsx(
                'flex items-center gap-1 rounded-md bg-white px-2 py-1 font-geist text-[11px] font-semibold text-[#141414] transition',
                'hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40'
              )}
              disabled={!activeFilePath || hasExternalFileConflict || isBinary || writeFileMutation.isPending || !isDirty}
              onClick={() => { void persistFile(); }}
              type="button"
            >
              {writeFileMutation.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Save className="h-3 w-3" />
              )}
              {writeFileMutation.isPending ? 'Saving' : 'Save'}
            </button>
          </div>
        </div>

        {saveNotice ? (
          <div className="border-b border-emerald-500/10 bg-emerald-500/[0.04] px-4 py-2 font-geist text-[12px] text-emerald-300">
            {saveNotice}
          </div>
        ) : null}

        {hasExternalFileConflict ? (
          <div className="flex items-center gap-2 border-b border-amber-500/10 bg-amber-500/[0.04] px-4 py-2 font-geist text-[12px] text-amber-300">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            This file changed on disk while you had unsaved edits. Reload it before saving so you can review the newer changes.
          </div>
        ) : null}

        {saveErrorMessage ? (
          <div className="flex items-center gap-2 border-b border-rose-500/10 bg-rose-500/[0.04] px-4 py-2 font-geist text-[12px] text-rose-300">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            {saveErrorMessage}
          </div>
        ) : null}

        {mode === 'diff' && isDirty ? (
          <div className="border-b border-amber-500/10 bg-amber-500/[0.04] px-4 py-2 font-geist text-[12px] text-amber-300">
            Diff reflects the last saved version. Save to refresh.
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-hidden">
          {!activeFilePath ? (
            <EditorEmptyState />
          ) : fileQuery.isLoading && loadedIdentity !== activeIdentity ? (
            <EditorMessage>
              <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
              Opening file...
            </EditorMessage>
          ) : loadErrorMessage ? (
            <EditorMessage tone="error">{loadErrorMessage}</EditorMessage>
          ) : isBinary ? (
            <EditorMessage>
              Binary files are not editable in Autocode yet.
            </EditorMessage>
          ) : mode === 'diff' ? (
            <WorkspaceDiffViewer
              diffText={diffQuery.data?.text ?? null}
              errorMessage={formatError(diffQuery.error)}
              isLoading={diffQuery.isLoading}
              selectedPath={activeFilePath}
            />
          ) : (
            <div className="h-full">
              <Suspense
                fallback={
                  <EditorMessage>
                    <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                    Loading editor...
                  </EditorMessage>
                }
              >
                <LazyCodeMirror
                  basicSetup={CODEMIRROR_BASIC_SETUP}
                  className="h-full text-[13px]"
                  extensions={languageExtensions}
                  height="100%"
                  onChange={(value) => {
                    setBufferContent(value);
                    setSaveNotice(null);
                    writeFileMutation.reset();
                  }}
                  theme={autocodeEditorTheme}
                  value={bufferContent}
                />
              </Suspense>
            </div>
          )}
        </div>
      </div>
    );
  }
);

function parseDiffMetadata(diffText: string) {
  let addedLinesCount = 0;
  let removedLinesCount = 0;

  for (const line of diffText.split('\n')) {
    if (line.startsWith('+++') || line.startsWith('---')) {
      continue;
    }

    if (line.startsWith('+')) {
      addedLinesCount += 1;
      continue;
    }

    if (line.startsWith('-')) {
      removedLinesCount += 1;
    }
  }

  return {
    addedLinesCount,
    isModified: addedLinesCount > 0 || removedLinesCount > 0,
    removedLinesCount
  };
}

function formatWorkspaceChangeLabel(status: WorkspaceChange['status']) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function basename(relativePath: string) {
  const segments = relativePath.split('/');
  return segments.at(-1) ?? relativePath;
}

function ModeToggle({
  isActive,
  label,
  onClick
}: {
  isActive: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={clsx(
        'rounded-md px-2.5 py-1 font-geist text-[11px] font-medium transition',
        isActive
          ? 'bg-white/[0.10] text-white'
          : 'text-white/40 hover:bg-white/[0.06] hover:text-white/70'
      )}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function StateBadge({ tone, value }: { tone: 'dirty' | 'modified'; value: string }) {
  return (
    <span className={clsx(
      'rounded-md border px-1.5 py-0.5 font-geist text-[10px] font-bold uppercase tracking-[0.06em]',
      tone === 'dirty'
        ? 'border-amber-500/20 bg-amber-500/10 text-amber-300'
        : 'border-sky-500/20 bg-sky-500/10 text-sky-300'
    )}>
      {value}
    </span>
  );
}

function MetricPill({ icon, label, value }: { icon?: React.ReactNode; label?: string; value: string }) {
  return (
    <span className="flex items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 font-geist text-[10px] text-white/30">
      {icon}
      {label ? <span>{label}</span> : null}
      <span className="tabular-nums text-white/50">{value}</span>
    </span>
  );
}

function EditorEmptyState() {
  return (
    <div className="grid h-full place-items-center px-8">
      <div className="max-w-sm text-center">
        <FileCode className="mx-auto mb-3 h-8 w-8 text-white/20" />
        <p className="font-geist text-[13px] font-medium text-white/60">Select a file to begin editing.</p>
        <p className="mt-1 font-geist text-[12px] text-white/30">
          Edits are scoped to the active task worktree.
        </p>
      </div>
    </div>
  );
}

function EditorMessage({ children, tone = 'subtle' }: { children: React.ReactNode; tone?: 'error' | 'subtle' }) {
  return (
    <div className="grid h-full place-items-center px-8">
      <p className={clsx(
        'max-w-xl text-center font-geist text-[13px]',
        tone === 'error' ? 'text-rose-300' : 'text-white/30'
      )}>
        {children}
      </p>
    </div>
  );
}

function formatError(error: unknown): string | null {
  return error instanceof Error ? error.message : null;
}
