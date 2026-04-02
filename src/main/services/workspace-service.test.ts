import { describe, expect, test } from 'bun:test';

import { resolveWorkspaceBaseRef } from './workspace-service';

describe('workspace service base ref resolution', () => {
  test('prefers the persisted task base ref for stacked workspaces', () => {
    expect(resolveWorkspaceBaseRef('autocode/task-4-parent', 'main')).toBe('autocode/task-4-parent');
  });

  test('falls back to the project default branch when no task base ref exists', () => {
    expect(resolveWorkspaceBaseRef(null, 'main')).toBe('main');
  });
});
