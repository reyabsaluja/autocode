import { memo, useEffect, useRef, useState } from 'react';
import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import { AlertTriangle } from 'lucide-react';

import type { AgentSessionTranscriptEntry } from '@shared/domain/agent-session';

import '@xterm/xterm/css/xterm.css';
import { filterTerminalRenderableEntries } from './transcript-rendering';

interface AgentSessionTerminalProps {
  entries: AgentSessionTranscriptEntry[];
  isInteractive: boolean;
  isVisible: boolean;
  onData: (text: string) => void;
  onResize: (cols: number, rows: number) => void;
  sessionId: number | null;
}

const TERMINAL_FONT_FAMILY =
  '"JetBrains Mono Variable", "JetBrains Mono", ui-monospace, SFMono-Regular, monospace';

export const AgentSessionTerminal = memo(function AgentSessionTerminal({
  entries,
  isInteractive,
  isVisible,
  onData,
  onResize,
  sessionId
}: AgentSessionTerminalProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const lastRenderedSeqRef = useRef(0);
  const onDataRef = useRef(onData);
  const onResizeRef = useRef(onResize);
  const [terminalError, setTerminalError] = useState<string | null>(null);

  useEffect(() => {
    onDataRef.current = onData;
  }, [onData]);

  useEffect(() => {
    onResizeRef.current = onResize;
  }, [onResize]);

  useEffect(() => {
    setTerminalError(null);
    const container = containerRef.current;

    if (!container) {
      return;
    }

    let terminal: Terminal | null = null;
    let fitAddon: FitAddon | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let dataDisposable: { dispose: () => void } | null = null;

    const reportTerminalError = (error: unknown, message: string) => {
      console.error('[AgentSessionTerminal] Failed to initialize terminal', error);
      setTerminalError(message);
    };

    try {
      terminal = new Terminal({
        allowTransparency: true,
        cursorBlink: true,
        cursorStyle: 'block',
        disableStdin: !isInteractive,
        fontFamily: TERMINAL_FONT_FAMILY,
        fontSize: 12,
        lineHeight: 1.35,
        theme: {
          background: '#101010',
          cursor: '#f4f4f5',
          foreground: '#f4f4f5',
          selectionBackground: 'rgba(255, 255, 255, 0.18)'
        }
      });
      fitAddon = new FitAddon();
      terminal.loadAddon(fitAddon);
      terminal.open(container);

      const resizeTerminal = () => {
        fitAddon!.fit();
        onResizeRef.current(terminal!.cols, terminal!.rows);
      };
      resizeObserver = new ResizeObserver(() => {
        try {
          resizeTerminal();
        } catch (error) {
          reportTerminalError(error, 'Autocode could not restore this terminal view.');
        }
      });
      dataDisposable = terminal.onData((value) => {
        onDataRef.current(value);
      });

      terminalRef.current = terminal;
      fitAddonRef.current = fitAddon;
      resizeObserver.observe(container);

      if (isVisible) {
        resizeTerminal();
      }
    } catch (error) {
      reportTerminalError(error, 'Autocode could not restore this terminal view.');
      dataDisposable?.dispose();
      resizeObserver?.disconnect();
      terminal?.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
      lastRenderedSeqRef.current = 0;
      return;
    }

    return () => {
      dataDisposable?.dispose();
      resizeObserver?.disconnect();
      terminal?.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
      lastRenderedSeqRef.current = 0;
    };
  }, []);

  useEffect(() => {
    if (!terminalRef.current || !fitAddonRef.current || !isVisible || terminalError) {
      return;
    }

    try {
      fitAddonRef.current.fit();
      onResizeRef.current(terminalRef.current.cols, terminalRef.current.rows);
    } catch (error) {
      console.error('[AgentSessionTerminal] Failed to resize terminal', error);
      setTerminalError('Autocode could not resize this terminal view.');
    }
  }, [isVisible, terminalError]);

  useEffect(() => {
    if (!terminalRef.current) {
      return;
    }

    terminalRef.current.options.disableStdin = !isInteractive;
  }, [isInteractive]);

  useEffect(() => {
    if (!terminalRef.current) {
      return;
    }

    terminalRef.current.clear();
    terminalRef.current.reset();
    lastRenderedSeqRef.current = 0;
  }, [sessionId]);

  useEffect(() => {
    const terminal = terminalRef.current;

    if (!terminal || terminalError) {
      return;
    }

    const nextEntries = filterTerminalRenderableEntries(entries)
      .filter((entry) => entry.seq > lastRenderedSeqRef.current)
      .sort((left, right) => left.seq - right.seq);

    try {
      for (const entry of nextEntries) {
        terminal.write(entry.text);
        lastRenderedSeqRef.current = entry.seq;
      }
    } catch (error) {
      console.error('[AgentSessionTerminal] Failed to render transcript entries', error);
      setTerminalError('Autocode could not replay this terminal transcript.');
    }
  }, [entries, terminalError]);

  if (terminalError) {
    return (
      <div className="grid h-full min-h-[180px] place-items-center px-6 text-center">
        <div className="max-w-md">
          <AlertTriangle className="mx-auto mb-4 h-8 w-8 text-rose-300/70" />
          <p className="font-geist text-[13px] font-medium text-white/75">{terminalError}</p>
        </div>
      </div>
    );
  }

  return <div className="h-full min-h-[180px] w-full" ref={containerRef} />;
});
