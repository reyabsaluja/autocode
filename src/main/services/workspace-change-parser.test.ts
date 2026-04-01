import { describe, expect, test } from 'bun:test';

import { parseWorkspaceChanges } from './workspace-change-parser';

describe('workspace change parser', () => {
  test('preserves the leading status padding on the first porcelain record', () => {
    const changes = parseWorkspaceChanges(' M app/page.tsx\0');

    expect(changes).toEqual([
      {
        previousPath: null,
        relativePath: 'app/page.tsx',
        status: 'modified'
      }
    ]);
  });

  test('preserves whitespace in unquoted paths', () => {
    const changes = parseWorkspaceChanges('??  spaced name.tsx \0');

    expect(changes).toEqual([
      {
        previousPath: null,
        relativePath: ' spaced name.tsx ',
        status: 'untracked'
      }
    ]);
  });
});
