import { describe, expect, test } from 'bun:test';

import { formatActiveSessionConflictMessage } from './agent-session-service';

describe('agent session service conflict messaging', () => {
  test('describes the existing active provider and recovery path', () => {
    expect(
      formatActiveSessionConflictMessage({
        command: 'codex',
        createdAt: '2026-04-02T12:00:00.000Z',
        endedAt: null,
        exitCode: null,
        id: 1,
        lastError: null,
        lastEventSeq: 0,
        pid: 123,
        provider: 'terminal',
        startedAt: '2026-04-02T12:00:00.000Z',
        status: 'running',
        taskId: 9,
        updatedAt: '2026-04-02T12:00:00.000Z',
        worktreeId: 2
      })
    ).toContain('active Terminal session');
  });
});
