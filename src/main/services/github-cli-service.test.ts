import { describe, expect, test } from 'bun:test';

import { normalizePullRequestInspectionError } from './github-cli-service';

describe('github cli inspection errors', () => {
  test('surfaces unexpected failures as explicit pull request errors', () => {
    const result = normalizePullRequestInspectionError(
      new Error('GitHub CLI is not installed or is not available on PATH.'),
      {
        baseBranch: 'main',
        branchName: 'autocode/task-9-child',
        publishStatus: {
          aheadCount: 0,
          behindCount: 0,
          branchName: 'autocode/task-9-child',
          canPush: false,
          defaultBranch: 'main',
          remoteName: 'origin',
          state: 'up_to_date',
          upstreamBranch: 'origin/autocode/task-9-child'
        }
      },
      {
        baseBranch: 'main',
        canCreate: true,
        headBranch: 'autocode/task-9-child',
        isDraft: false,
        message: 'Ready to open a pull request into main.',
        number: null,
        state: 'none',
        url: null
      }
    );

    expect(result).toMatchObject({
      canCreate: false,
      message: 'GitHub CLI is not installed or is not available on PATH.',
      state: 'error'
    });
  });
});
