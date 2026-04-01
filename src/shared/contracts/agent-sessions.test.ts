import { describe, expect, test } from 'bun:test';

import {
  agentSessionEventResultSchema,
  readAgentSessionTranscriptTailInputSchema
} from './agent-sessions';

describe('agent session contracts', () => {
  test('applies transcript tail defaults', () => {
    const result = readAgentSessionTranscriptTailInputSchema.parse({
      sessionId: 12
    });

    expect(result).toEqual({
      maxEntries: 500,
      sessionId: 12
    });
  });

  test('validates snapshot events', () => {
    const result = agentSessionEventResultSchema.parse({
      session: {
        command: 'codex',
        createdAt: '2026-04-01T12:00:00.000Z',
        endedAt: null,
        exitCode: null,
        id: 1,
        lastError: null,
        lastEventSeq: 2,
        pid: 12345,
        provider: 'codex',
        startedAt: '2026-04-01T12:00:00.000Z',
        status: 'running',
        taskId: 7,
        updatedAt: '2026-04-01T12:00:01.000Z',
        worktreeId: 9
      },
      type: 'snapshot'
    });

    expect(result.type).toBe('snapshot');

    if (result.type !== 'snapshot') {
      throw new Error('Expected a snapshot event.');
    }

    expect(result.session.status).toBe('running');
  });

  test('rejects malformed entry events', () => {
    expect(() =>
      agentSessionEventResultSchema.parse({
        entries: [
          {
            at: '2026-04-01T12:00:00.000Z',
            seq: 0,
            stream: 'stdout',
            text: 'hello'
          }
        ],
        sessionId: 1,
        type: 'entries'
      })
    ).toThrow();
  });
});
