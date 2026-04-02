import { memo } from 'react';
import { Loader2, Terminal } from 'lucide-react';

import type { AgentSessionTranscriptEntry } from '@shared/domain/agent-session';

import { AgentSessionTerminal } from './agent-session-terminal';

interface WorkspaceTerminalSurfaceProps {
  emptyStateMode: 'idle' | 'selectSession' | 'starting';
  entries: AgentSessionTranscriptEntry[];
  errorMessage: string | null;
  isInteractive: boolean;
  onData: (text: string) => void;
  onResize: (cols: number, rows: number) => void;
  sessionId: number | null;
}

export const WorkspaceTerminalSurface = memo(function WorkspaceTerminalSurface({
  emptyStateMode,
  entries,
  errorMessage,
  isInteractive,
  onData,
  onResize,
  sessionId
}: WorkspaceTerminalSurfaceProps) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden border-r border-white/[0.06] bg-surface-0">
      {errorMessage ? (
        <div className="border-b border-rose-500/20 bg-rose-500/[0.06] px-4 py-2 font-geist text-[12px] text-rose-200">
          {errorMessage}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-hidden bg-[#101010]">
        {sessionId !== null ? (
          <AgentSessionTerminal
            entries={entries}
            isInteractive={isInteractive}
            isVisible
            onData={onData}
            onResize={onResize}
            sessionId={sessionId}
          />
        ) : (
          <div className="grid h-full place-items-center px-6 text-center">
            <div className="max-w-md">
              {emptyStateMode === 'starting' ? (
                <>
                  <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-white/18" />
                  <p className="font-geist text-[14px] font-medium text-white/72">
                    Starting session
                  </p>
                </>
              ) : emptyStateMode === 'selectSession' ? (
                <>
                  <Terminal className="mx-auto mb-4 h-8 w-8 text-white/15" />
                  <p className="font-geist text-[14px] font-medium text-white/72">
                    Select a session tab to reopen its transcript.
                  </p>
                </>
              ) : (
                <>
                  <Terminal className="mx-auto mb-4 h-8 w-8 text-white/15" />
                  <p className="font-geist text-[14px] font-medium text-white/72">
                    Open a terminal or start an agent session to work in this worktree.
                  </p>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
