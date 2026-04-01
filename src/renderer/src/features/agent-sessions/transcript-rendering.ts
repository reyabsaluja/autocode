import type { AgentSessionTranscriptEntry } from '@shared/domain/agent-session';

export function filterTerminalRenderableEntries(
  entries: AgentSessionTranscriptEntry[]
): AgentSessionTranscriptEntry[] {
  return entries.filter((entry) => entry.stream !== 'stdin');
}
