import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { oneDark } from '@codemirror/theme-one-dark';

import type { WorkspaceChange } from '@shared/domain/workspace-inspection';

import { WorkspaceDiffViewer } from '../workspace/workspace-diff-viewer';
import { useWorkspaceDiffQuery } from '../workspace/workspace-hooks';
import { inferLanguageSupport } from './editor-language';
import { useWorkspaceFileQuery, useWriteWorkspaceFileMutation } from './editor-hooks';

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
    // Keep the edit surface lightweight: change badges come from workspace status,
    // while full git diffs only load when the user explicitly enters diff mode.
    const shouldLoadDiff = mode === 'diff' && activeFilePath !== null;
    const fileQuery = useWorkspaceFileQuery(taskId, activeFilePath, shouldLoadFile);
    const diffQuery = useWorkspaceDiffQuery(taskId, activeFilePath, shouldLoadDiff);
    const writeFileMutation = useWriteWorkspaceFileMutation(taskId, activeFilePath);
    const [bufferContent, setBufferContent] = useState('');
    const [lastSavedContent, setLastSavedContent] = useState('');
    const [loadedIdentity, setLoadedIdentity] = useState<string | null>(null);
    const [saveNotice, setSaveNotice] = useState<string | null>(null);
    const activeIdentity = activeFilePath ? `${taskId}:${activeFilePath}` : null;
    const isDirty = bufferContent !== lastSavedContent;
    const languageExtensions = useMemo(
      () => (activeFilePath ? inferLanguageSupport(activeFilePath) : []),
      [activeFilePath]
    );
    const diffLineSummary = useMemo(() => {
      if (mode !== 'diff' || !diffQuery.data?.text) {
        return null;
      }

      return parseDiffMetadata(diffQuery.data.text);
    }, [diffQuery.data?.text, mode]);

    useEffect(() => {
      // Reset the editor only when the task/file identity changes. View-mode switches
      // must preserve the in-memory buffer so diff/edit toggles stay non-destructive.
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
        return;
      }

      setBufferContent(nextContent);
      setLastSavedContent(nextContent);
      setLoadedIdentity(activeIdentity);
      setSaveNotice(null);
    }, [activeIdentity, fileQuery.data, isDirty, loadedIdentity, shouldLoadFile]);

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
          setBufferContent(lastSavedContent);
          setSaveNotice(null);
          writeFileMutation.reset();
        },
        getActiveFilePath: () => activeFilePath,
        hasUnsavedChanges: () => isDirty,
        saveActiveFile: () => persistFile()
      }),
      [activeFilePath, bufferContent, fileQuery.data?.isBinary, isDirty, lastSavedContent, writeFileMutation]
    );

    const persistFile = async () => {
      if (!activeFilePath || fileQuery.data?.isBinary) {
        return false;
      }

      try {
        const result = await writeFileMutation.mutateAsync({
          content: bufferContent
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
    const editorTitle = activeFilePath ? basename(activeFilePath) : 'Workspace editor';

    return (
      <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[24px] border border-white/8 bg-[#0b0d10] shadow-[0_30px_90px_rgba(0,0,0,0.36)]">
        <div className="border-b border-white/6 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-semibold text-white">{editorTitle}</p>
                {isDirty ? <StateBadge tone="dirty" value="Unsaved" /> : null}
                {activeChange ? (
                  <StateBadge
                    tone="modified"
                    value={formatWorkspaceChangeLabel(activeChange.status)}
                  />
                ) : null}
              </div>
              <p className="mt-1 truncate text-xs text-slate-500">
                {activeFilePath ?? 'Select a file from the workspace tree to edit it here.'}
              </p>
            </div>

            <div className="flex items-center gap-2">
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
              <button
                className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!activeFilePath || !isDirty}
                onClick={() => setBufferContent(lastSavedContent)}
                type="button"
              >
                Discard
              </button>
              <button
                className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!activeFilePath || isBinary || writeFileMutation.isPending || !isDirty}
                onClick={() => {
                  void persistFile();
                }}
                type="button"
              >
                {writeFileMutation.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <MetricPill
              label="Lines"
              value={String(bufferContent.length === 0 ? 0 : bufferContent.split('\n').length)}
            />
            {diffLineSummary ? (
              <>
                <MetricPill
                  label="Added"
                  value={String(diffLineSummary.addedLinesCount)}
                />
                <MetricPill
                  label="Removed"
                  value={String(diffLineSummary.removedLinesCount)}
                />
              </>
            ) : null}
            {fileQuery.data ? (
              <MetricPill
                label="Bytes"
                value={String(fileQuery.data.sizeBytes)}
              />
            ) : null}
          </div>
        </div>

        {saveNotice ? (
          <div className="border-b border-emerald-400/10 bg-emerald-400/8 px-4 py-3 text-sm text-emerald-200">
            {saveNotice}
          </div>
        ) : null}

        {saveErrorMessage ? (
          <div className="border-b border-rose-400/10 bg-rose-400/8 px-4 py-3 text-sm text-rose-200">
            {saveErrorMessage}
          </div>
        ) : null}

        {mode === 'diff' && isDirty ? (
          <div className="border-b border-amber-400/10 bg-amber-400/8 px-4 py-3 text-sm text-amber-200">
            Diff view reflects the last saved file on disk. Save to refresh it.
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-hidden">
          {!activeFilePath ? (
            <EditorEmptyState />
          ) : fileQuery.isLoading && loadedIdentity !== activeIdentity ? (
            <EditorMessage label="Opening file…" />
          ) : loadErrorMessage ? (
            <EditorMessage label={loadErrorMessage} tone="error" />
          ) : isBinary ? (
            <EditorMessage label="Binary files can be inspected through the workspace tree, but they are not editable in Autocode yet." />
          ) : mode === 'diff' ? (
            <WorkspaceDiffViewer
              diffText={diffQuery.data?.text ?? null}
              errorMessage={formatError(diffQuery.error)}
              isLoading={diffQuery.isLoading}
              selectedPath={activeFilePath}
            />
          ) : (
            <div className="h-full bg-[#0a0b0d]">
              <CodeMirror
                basicSetup={{
                  foldGutter: false,
                  highlightActiveLineGutter: true
                }}
                className="h-full text-[13px]"
                extensions={languageExtensions}
                height="100%"
                onChange={(value) => {
                  setBufferContent(value);
                  setSaveNotice(null);
                  writeFileMutation.reset();
                }}
                theme={oneDark}
                value={bufferContent}
              />
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
      className={`rounded-2xl px-3 py-2 text-sm font-medium transition ${
        isActive
          ? 'bg-white/[0.08] text-white'
          : 'text-slate-500 hover:bg-white/[0.04] hover:text-slate-200'
      }`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function StateBadge({ tone, value }: { tone: 'dirty' | 'modified'; value: string }) {
  const styles =
    tone === 'dirty'
      ? 'border-amber-400/20 bg-amber-400/10 text-amber-200'
      : 'border-sky-400/20 bg-sky-400/10 text-sky-200';

  return (
    <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${styles}`}>
      {value}
    </span>
  );
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-full border border-white/8 bg-white/[0.03] px-2 py-1">
      <span className="text-slate-500">{label}</span> {value}
    </span>
  );
}

function EditorEmptyState() {
  return (
    <div className="grid h-full place-items-center px-8">
      <div className="max-w-md text-center">
        <p className="text-sm font-medium text-slate-200">Select a workspace file to begin editing.</p>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          This editor only opens files from the active task worktree, so edits stay scoped to the selected workspace.
        </p>
      </div>
    </div>
  );
}

function EditorMessage({ label, tone = 'subtle' }: { label: string; tone?: 'error' | 'subtle' }) {
  return (
    <div className="grid h-full place-items-center px-8">
      <p className={`max-w-xl text-center text-sm leading-6 ${tone === 'error' ? 'text-rose-300' : 'text-slate-500'}`}>
        {label}
      </p>
    </div>
  );
}

function formatError(error: unknown): string | null {
  return error instanceof Error ? error.message : null;
}
