import type { AgentSessionTranscriptEntry } from '@shared/domain/agent-session';

export function filterTerminalRenderableEntries(
  entries: AgentSessionTranscriptEntry[]
): AgentSessionTranscriptEntry[] {
  let nextEntries: AgentSessionTranscriptEntry[] | null = null;

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index]!;

    if (entry.stream === 'stdin') {
      if (!nextEntries) {
        nextEntries = entries.slice(0, index);
      }

      continue;
    }

    nextEntries?.push(entry);
  }

  return nextEntries ?? entries;
}
