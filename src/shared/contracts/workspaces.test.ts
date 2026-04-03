import { describe, expect, test } from 'bun:test';

import {
  workspaceChangesResultSchema,
  workspaceInspectionEventResultSchema,
  workspaceRecentCommitsResultSchema,
  workspacePublishStatusResultSchema
} from './workspaces';

describe('workspace contracts', () => {
  test('validates workspace inspection refresh events', () => {
    const result = workspaceInspectionEventResultSchema.parse({
      taskId: 14,
      type: 'inspectionChanged'
    });

    expect(result).toEqual({
      taskId: 14,
      type: 'inspectionChanged'
    });
  });

  test('rejects malformed workspace inspection events', () => {
    expect(() =>
      workspaceInspectionEventResultSchema.parse({
        taskId: 0,
        type: 'inspectionChanged'
      })
    ).toThrow();
  });

  test('keeps live workspace changes focused on the changes surface', () => {
    const result = workspaceChangesResultSchema.parse({
      changes: [],
      observation: {
        didHealthChange: false,
        project: {
          createdAt: '2026-04-01T12:00:00.000Z',
          defaultBranch: 'main',
          gitRoot: '/tmp/demo',
          id: 3,
          name: 'demo',
          repoPath: '/tmp/demo',
          updatedAt: '2026-04-01T12:00:00.000Z'
        },
        taskWorkspace: {
          task: {
            createdAt: '2026-04-01T12:00:00.000Z',
            description: null,
            id: 8,
            lastError: null,
            projectId: 3,
            status: 'ready',
            title: 'Task',
            updatedAt: '2026-04-01T12:00:00.000Z'
          },
          worktree: {
            baseRef: null,
            branchName: 'task-8',
            createdAt: '2026-04-01T12:00:00.000Z',
            id: 5,
            projectId: 3,
            status: 'ready',
            taskId: 8,
            worktreePath: '/tmp/demo/.autocode/task-8',
            updatedAt: '2026-04-01T12:00:00.000Z'
          }
        }
      }
    });

    expect(result.changes).toEqual([]);
  });

  test('validates recent commit results separately from the live changes query', () => {
    const result = workspaceRecentCommitsResultSchema.parse([
      {
        message: 'Initial commit',
        relativeTime: '2 minutes ago',
        sha: 'abcdef1234'
      }
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.sha).toBe('abcdef1234');
  });

  test('accepts explicit pull request inspection failures', () => {
    const result = workspacePublishStatusResultSchema.parse({
      publish: {
        aheadCount: 0,
        behindCount: 0,
        branchName: 'autocode/task-8',
        canPush: false,
        defaultBranch: 'main',
        remoteName: 'origin',
        state: 'up_to_date',
        upstreamBranch: 'origin/autocode/task-8'
      },
      pullRequest: {
        baseBranch: 'main',
        canCreate: false,
        headBranch: 'autocode/task-8',
        isDraft: false,
        message: 'GitHub CLI is not installed or is not available on PATH.',
        number: null,
        state: 'error',
        url: null
      }
    });

    expect(result.pullRequest.state).toBe('error');
  });
});
