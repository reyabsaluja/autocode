import { describe, expect, test } from 'bun:test';
import { EventEmitter } from 'node:events';

import { createExternalEditorService } from './external-editor-service';

describe('external editor service', () => {
  test('rejects missing CLI editors without an unhandled child process error', async () => {
    const child = new FakeDetachedChildProcess();
    const service = createExternalEditorService({
      openPath: async () => '',
      spawn: () => child
    });
    const launch = service.openInEditor({
      editor: 'vscode',
      worktreePath: '/tmp/demo'
    });

    child.emit('error', Object.assign(new Error('spawn code ENOENT'), { code: 'ENOENT' }));

    await expect(launch).rejects.toThrow('VS Code is not installed or is not available on PATH.');
    expect(child.didUnref).toBe(false);
  });

  test('unrefs CLI editor processes after a successful spawn', async () => {
    const child = new FakeDetachedChildProcess();
    const spawnCalls: Array<{ args: string[]; command: string }> = [];
    const service = createExternalEditorService({
      openPath: async () => '',
      spawn: (command, args) => {
        spawnCalls.push({ args, command });
        return child;
      }
    });
    const launch = service.openInEditor({
      editor: 'cursor',
      worktreePath: '/tmp/demo'
    });

    child.emit('spawn');

    await expect(launch).resolves.toBeUndefined();
    expect(spawnCalls).toEqual([{ args: ['/tmp/demo'], command: 'cursor' }]);
    expect(child.didUnref).toBe(true);
  });

  test('surfaces Finder openPath failures', async () => {
    const service = createExternalEditorService({
      openPath: async () => 'The file does not exist.'
    });

    await expect(
      service.openInEditor({
        editor: 'finder',
        worktreePath: '/tmp/missing'
      })
    ).rejects.toThrow('The file does not exist.');
  });
});

class FakeDetachedChildProcess extends EventEmitter {
  didUnref = false;

  unref(): void {
    this.didUnref = true;
  }
}
