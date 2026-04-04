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
      const trimmed = label.trim();
      if (!trimmed) return state;

      const truncated = trimmed.length > MAX_LABEL_LENGTH
        ? `${trimmed.slice(0, MAX_LABEL_LENGTH)}\u2026`
        : trimmed;

      if (state.labels[sessionId] === truncated) return state;

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

const ANSI_ESCAPE_RE = /\x1b(?:\[[0-9;?]*[A-Za-z]|\][^\x07\x1b]*(?:\x07|\x1b\\)?|[()][0-2AB]|[NO].?|[=>])/g;

export function appendStdinForLabel(sessionId: number, text: string): void {
  const cleaned = text.replace(ANSI_ESCAPE_RE, '');
  let buffer = stdinBuffers.get(sessionId) ?? '';

  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i]!;

    if (char === '\r' || char === '\n') {
      const commandLine = buffer.trim();
      buffer = '';
      if (commandLine) {
        useSessionLabelStore.getState().setLabel(sessionId, commandLine);
      }
    } else if (char === '\x7f' || char === '\x08') {
      buffer = buffer.slice(0, -1);
    } else if (char.charCodeAt(0) >= 0x20) {
      buffer += char;
    }
  }

  if (buffer) {
    stdinBuffers.set(sessionId, buffer);
  } else {
    stdinBuffers.delete(sessionId);
  }
}

export function clearStdinBuffer(sessionId: number): void {
  stdinBuffers.delete(sessionId);
}
