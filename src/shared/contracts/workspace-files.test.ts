import { describe, expect, test } from 'bun:test';

import { workspaceFileWriteInputSchema } from './workspace-files';

describe('workspace file contracts', () => {
  test('requires the last-known disk content for safe saves', () => {
    const result = workspaceFileWriteInputSchema.parse({
      content: 'next',
      expectedContent: 'current',
      relativePath: 'src/app.ts',
      taskId: 4
    });

    expect(result.expectedContent).toBe('current');
  });

  test('rejects save requests without the last-known disk content', () => {
    expect(() =>
      workspaceFileWriteInputSchema.parse({
        content: 'next',
        relativePath: 'src/app.ts',
        taskId: 4
      })
    ).toThrow();
  });
});
