import { describe, expect, test } from 'bun:test';

import {
  updateTaskStatusInputSchema,
  updateTaskStatusResultSchema
} from './tasks';

describe('task contracts', () => {
  test('validates explicit task status updates', () => {
    const result = updateTaskStatusInputSchema.parse({
      status: 'needs_review',
      taskId: 12
    });

    expect(result).toEqual({
      status: 'needs_review',
      taskId: 12
    });
  });

  test('rejects unsupported manual task targets', () => {
    expect(() =>
      updateTaskStatusInputSchema.parse({
        status: 'failed',
        taskId: 12
      })
    ).toThrow();
  });

  test('keeps task status updates aligned with task list cache sync', () => {
    const result = updateTaskStatusResultSchema.parse({
      project: {
        createdAt: '2026-04-02T12:00:00.000Z',
        defaultBranch: 'main',
        gitRoot: '/tmp/demo',
        id: 3,
        name: 'demo',
        repoPath: '/tmp/demo',
        updatedAt: '2026-04-02T12:01:00.000Z'
      },
      taskWorkspace: {
        task: {
          createdAt: '2026-04-02T12:00:00.000Z',
          description: 'Review the workspace',
          id: 8,
          lastError: null,
          projectId: 3,
          status: 'needs_review',
          title: 'Task',
          updatedAt: '2026-04-02T12:01:00.000Z'
        },
        worktree: {
          baseRef: 'main',
          branchName: 'task-8',
          createdAt: '2026-04-02T12:00:00.000Z',
          id: 5,
          projectId: 3,
          status: 'dirty',
          taskId: 8,
          worktreePath: '/tmp/demo/.autocode/task-8',
          updatedAt: '2026-04-02T12:01:00.000Z'
        }
      }
    });

    expect(result.taskWorkspace.task.status).toBe('needs_review');
  });
});
