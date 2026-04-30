import { describe, expect, test } from 'bun:test';

import { taskChannels } from './channels';

describe('task IPC channels', () => {
  test('exposes explicit lifecycle status updates', () => {
    expect(taskChannels.updateStatus).toBe('tasks:updateStatus');
  });
});
