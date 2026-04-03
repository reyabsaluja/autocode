import { create } from 'zustand';

const MAX_LABEL_LENGTH = 32;

interface SessionLabelState {
  labels: Record<number, string>;
  setLabel: (sessionId: number, label: string) => void;
  removeLabel: (sessionId: number) => void;
}

export const useSessionLabelStore = create<SessionLabelState>()((set) => ({
  labels: {},
  setLabel: (sessionId, label) =>
    set((state) => {
      if (state.labels[sessionId]) return state;

      const trimmed = label.trim();
      if (!trimmed) return state;

      const truncated = trimmed.length > MAX_LABEL_LENGTH
        ? `${trimmed.slice(0, MAX_LABEL_LENGTH)}\u2026`
        : trimmed;

      return { labels: { ...state.labels, [sessionId]: truncated } };
    }),
  removeLabel: (sessionId) =>
    set((state) => {
      if (!(sessionId in state.labels)) return state;
      const { [sessionId]: _, ...rest } = state.labels;
      return { labels: rest };
    })
}));

const stdinBuffers = new Map<number, string>();

// Matches ANSI escape sequences (CSI, OSC, SS3, etc.) and standalone control chars
const ANSI_ESCAPE_RE = /\x1b(?:\[[0-9;?]*[A-Za-z]|\][^\x07\x1b]*(?:\x07|\x1b\\)?|[()][0-2AB]|[NO].?|[=>])/g;
const CONTROL_CHAR_RE = /[\x00-\x1f\x7f]/g;

function stripTerminalNoise(text: string): string {
  return text.replace(ANSI_ESCAPE_RE, '').replace(CONTROL_CHAR_RE, '');
}

export function appendStdinForLabel(sessionId: number, text: string): void {
  const store = useSessionLabelStore.getState();
  if (store.labels[sessionId]) return;

  const buffer = (stdinBuffers.get(sessionId) ?? '') + text;
  const newlineIndex = buffer.search(/[\r\n]/);

  if (newlineIndex >= 0) {
    const firstLine = stripTerminalNoise(buffer.slice(0, newlineIndex)).trim();
    stdinBuffers.delete(sessionId);
    if (firstLine) {
      store.setLabel(sessionId, firstLine);
    }
  } else {
    stdinBuffers.set(sessionId, buffer);
  }
}

export function clearStdinBuffer(sessionId: number): void {
  stdinBuffers.delete(sessionId);
}
