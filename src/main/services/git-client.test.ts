import { describe, expect, test } from 'bun:test';

import { resolvePushGitBranchArgs } from './git-client';

describe('git client push argument resolution', () => {
  test('pushes published task branches with an explicit remote refspec', () => {
    expect(
      resolvePushGitBranchArgs({
        branchName: 'autocode/task-15-task-c',
        remoteName: 'origin',
        upstreamBranch: 'origin/autocode/task-15-task-c'
      })
    ).toEqual([
      'push',
      'origin',
      'autocode/task-15-task-c:refs/heads/autocode/task-15-task-c'
    ]);
  });

  test('preserves an existing upstream branch name when it differs from the local branch', () => {
    expect(
      resolvePushGitBranchArgs({
        branchName: 'autocode/task-15-task-c',
        remoteName: 'origin',
        upstreamBranch: 'origin/review/task-c'
      })
    ).toEqual([
      'push',
      'origin',
      'autocode/task-15-task-c:refs/heads/review/task-c'
    ]);
  });

  test('publishes unpublished task branches with an explicit upstream refspec', () => {
    expect(
      resolvePushGitBranchArgs({
        branchName: 'autocode/task-15-task-c',
        remoteName: 'origin',
        upstreamBranch: null
      })
    ).toEqual([
      'push',
      '--set-upstream',
      'origin',
      'autocode/task-15-task-c:refs/heads/autocode/task-15-task-c'
    ]);
  });
});
