import { describe, expect, test } from 'bun:test';

import { workspaceInspectionEventResultSchema } from './workspaces';

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
});
