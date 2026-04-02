import { describe, expect, test } from 'bun:test';

import {
  workspaceChangesResultSchema,
  workspaceInspectionEventResultSchema,
  workspaceRecentCommitsResultSchema
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
});
