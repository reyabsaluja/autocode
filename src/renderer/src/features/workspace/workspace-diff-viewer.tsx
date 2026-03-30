import clsx from 'clsx';
import { Loader2 } from 'lucide-react';

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
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-panel border border-border bg-surface-1 shadow-panel">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted">
          Diff
        </span>
        <span className="max-w-[60%] truncate text-[12px] text-text-faint">
          {selectedPath ?? 'Select a changed file'}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {isLoading ? (
          <DiffMessage>
            <Loader2 className="mr-1.5 inline h-3 w-3 animate-spin" />
            Loading diff
          </DiffMessage>
        ) : null}

        {errorMessage ? <DiffMessage tone="error">{errorMessage}</DiffMessage> : null}

        {!isLoading && !errorMessage && !selectedPath ? (
          <DiffMessage>Pick a file from the changes list or file explorer.</DiffMessage>
        ) : null}

        {!isLoading && !errorMessage && selectedPath && !diffText ? (
          <DiffMessage>No diff available for this file.</DiffMessage>
        ) : null}

        {!isLoading && !errorMessage && diffText ? (
          <pre className="whitespace-pre-wrap break-words px-4 py-4 font-mono text-[12px] leading-[1.7] text-text-secondary">
            {diffText.split('\n').map((line, index) => (
              <span
                key={index}
                className={clsx(
                  'block px-1',
                  line.startsWith('+') && !line.startsWith('+++') && 'bg-emerald-500/[0.06] text-emerald-300',
                  line.startsWith('-') && !line.startsWith('---') && 'bg-rose-500/[0.06] text-rose-300',
                  line.startsWith('@@') && 'text-sky-400/80'
                )}
              >
                {line}
              </span>
            ))}
          </pre>
        ) : null}
      </div>
    </div>
  );
}

function DiffMessage({ children, tone = 'subtle' }: { children: React.ReactNode; tone?: 'error' | 'subtle' }) {
  return (
    <p className={clsx(
      'px-4 py-4 text-[13px]',
      tone === 'error' ? 'text-rose-400' : 'text-text-faint'
    )}>
      {children}
    </p>
  );
}
