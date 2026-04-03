import { describe, expect, test } from 'bun:test';

import { resolveWorkspaceBaseRef, resolveWorkspacePullRequestBaseBranch } from './workspace-service';

describe('workspace service base ref resolution', () => {
  test('prefers the persisted task base ref for stacked workspaces', () => {
    expect(resolveWorkspaceBaseRef('autocode/task-4-parent', 'main')).toBe('autocode/task-4-parent');
  });

  test('falls back to the project default branch when no task base ref exists', () => {
    expect(resolveWorkspaceBaseRef(null, 'main')).toBe('main');
  });
});

describe('workspace service pull request base branch resolution', () => {
  test('normalizes remote-tracking default refs before opening pull requests', () => {
    expect(resolveWorkspacePullRequestBaseBranch('origin/main', 'main')).toBe('main');
  });

  test('preserves stacked task base branches for pull requests', () => {
    expect(resolveWorkspacePullRequestBaseBranch('autocode/task-4-parent', 'main')).toBe(
      'autocode/task-4-parent'
    );
  });

  test('falls back to the project default branch when no task base ref exists', () => {
    expect(resolveWorkspacePullRequestBaseBranch(null, 'main')).toBe('main');
  });
});
