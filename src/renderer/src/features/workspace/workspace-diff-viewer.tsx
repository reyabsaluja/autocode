interface WorkspaceDiffViewerProps {
  diffText: string | null;
  errorMessage: string | null;
  isLoading: boolean;
  selectedPath: string | null;
}

export function WorkspaceDiffViewer({
  diffText,
  errorMessage,
  isLoading,
  selectedPath
}: WorkspaceDiffViewerProps) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[24px] border border-white/8 bg-[#0b0c0f] text-slate-100 shadow-[0_30px_90px_rgba(0,0,0,0.36)]">
      <div className="flex items-center justify-between border-b border-white/6 px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
          Diff
        </p>
        <p className="truncate text-sm leading-6 text-slate-400">
          {selectedPath ?? 'Select a changed file to inspect the diff.'}
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {isLoading ? <DiffMessage label="Loading diff" /> : null}
        {errorMessage ? <DiffMessage label={errorMessage} tone="error" /> : null}
        {!isLoading && !errorMessage && !selectedPath ? (
          <DiffMessage label="Pick a file from the changes list or file explorer." />
        ) : null}
        {!isLoading && !errorMessage && selectedPath && !diffText ? (
          <DiffMessage label="No diff is available for the selected file." />
        ) : null}

        {!isLoading && !errorMessage && diffText ? (
          <pre className="whitespace-pre-wrap break-words px-5 py-5 font-mono text-[12px] leading-6 text-slate-100">
            {diffText}
          </pre>
        ) : null}
      </div>
    </div>
  );
}

function DiffMessage({ label, tone = 'subtle' }: { label: string; tone?: 'error' | 'subtle' }) {
  return (
    <p className={`px-5 py-5 text-sm ${tone === 'error' ? 'text-rose-300' : 'text-slate-400'}`}>
      {label}
    </p>
  );
}
