import { describe, expect, test } from 'bun:test';

import type { AgentSessionTranscriptEntry } from '@shared/domain/agent-session';

import { filterTerminalRenderableEntries } from './transcript-rendering';

describe('terminal transcript rendering', () => {
  test('excludes stdin entries so the terminal does not replay typed input', () => {
    const entries: AgentSessionTranscriptEntry[] = [
      {
        at: '2026-04-01T12:00:00.000Z',
        seq: 1,
        stream: 'stdin',
        text: '\u001b[A'
      },
      {
        at: '2026-04-01T12:00:01.000Z',
        seq: 2,
        stream: 'stdout',
        text: 'restored-command\n'
      },
      {
        at: '2026-04-01T12:00:02.000Z',
        seq: 3,
        stream: 'system',
        text: 'Session terminated by user.'
      }
    ];

    expect(filterTerminalRenderableEntries(entries).map((entry) => entry.seq)).toEqual([2, 3]);
  });
});
