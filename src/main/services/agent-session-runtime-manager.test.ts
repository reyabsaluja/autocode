import { describe, expect, test } from 'bun:test';
import type { IPty } from 'node-pty';

import { createAgentSessionRuntimeManager } from './agent-session-runtime-manager';

describe('agent session runtime manager', () => {
  test('cleans up a created tmux session before falling back to a direct spawn', async () => {
    const killCalls: string[] = [];
    const aliveChecks: string[] = [];
    const spawnCommands: string[] = [];
    const directRuntime = createFakePty(4312);

    const runtimeManager = createAgentSessionRuntimeManager({
      agentSessionRepository: createAgentSessionRepositoryStub(),
      dependencies: {
        checkTmuxAvailability: async () => true,
        createTmuxSession: async () => undefined,
        getTmuxAttachSpawnArgs: (sessionName) => ({
          args: ['attach-session', '-t', sessionName],
          command: 'tmux'
        }),
        getTmuxSessionName: () => 's42',
        isTmuxSessionAlive: async (sessionName) => {
          aliveChecks.push(sessionName);
          return false;
        },
        killTmuxSession: async (sessionName) => {
          killCalls.push(sessionName);
        },
        resizeTmuxSession: async () => undefined,
        spawnPty: ((command) => {
          spawnCommands.push(command);

          if (command === 'tmux') {
            throw new Error('tmux attach failed');
          }

          return directRuntime;
        }) as typeof import('node-pty').spawn
      },
      publishEvent: () => undefined
    });

    await runtimeManager.reconcileInterruptedSessions();

    const result = await runtimeManager.startRuntime({
      cols: 120,
      cwd: '/tmp',
      env: { PATH: '/usr/bin:/bin' },
      executablePath: '/bin/zsh',
      provider: 'terminal',
      rows: 30,
      sessionId: 42,
      transcriptPath: '/tmp/session.ndjson'
    });

    expect(result.pid).toBe(4312);
    expect(spawnCommands).toEqual(['tmux', '/bin/zsh']);
    expect(killCalls).toEqual(['s42']);
    expect(aliveChecks).toEqual(['s42']);
  });
});

function createAgentSessionRepositoryStub() {
  return {
    findById: () => null,
    findInternalById: () => null,
    finalize: () => {
      throw new Error('finalize should not be called in this test');
    },
    listActiveSessions: () => [],
    updateLastEventSeq: () => {
      throw new Error('updateLastEventSeq should not be called in this test');
    }
  } as any;
}

function createFakePty(pid: number): IPty {
  return {
    clear: () => undefined,
    cols: 120,
    handleFlowControl: false,
    kill: () => undefined,
    onData: () => ({ dispose: () => undefined }),
    onExit: () => ({ dispose: () => undefined }),
    pause: () => undefined,
    pid,
    process: 'zsh',
    resize: () => undefined,
    resume: () => undefined,
    rows: 30,
    write: () => undefined
  };
}
