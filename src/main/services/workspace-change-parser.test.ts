import { describe, expect, test } from 'bun:test';

import { parseWorkspaceChanges } from './workspace-change-parser';

describe('workspace change parser', () => {
  test('preserves the leading status padding on the first porcelain record', () => {
    const changes = parseWorkspaceChanges(' M app/page.tsx\0');

    expect(changes).toEqual([
      {
        isStaged: false,
        linesAdded: null,
        linesRemoved: null,
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
        isStaged: false,
        linesAdded: null,
        linesRemoved: null,
        previousPath: null,
        relativePath: ' spaced name.tsx ',
        status: 'untracked'
      }
    ]);
  });

  test('parses rename records without relying on a full token split', () => {
    const changes = parseWorkspaceChanges('R  app/new-name.tsx\0app/old-name.tsx\0');

    expect(changes).toEqual([
      {
        isStaged: true,
        linesAdded: null,
        linesRemoved: null,
        previousPath: 'app/old-name.tsx',
        relativePath: 'app/new-name.tsx',
        status: 'renamed'
      }
    ]);
  });

  test('parses multiple records in sequence', () => {
    const changes = parseWorkspaceChanges(' M app/page.tsx\0?? notes/todo.md\0');

    expect(changes).toEqual([
      {
        isStaged: false,
        linesAdded: null,
        linesRemoved: null,
        previousPath: null,
        relativePath: 'app/page.tsx',
        status: 'modified'
      },
      {
        isStaged: false,
        linesAdded: null,
        linesRemoved: null,
        previousPath: null,
        relativePath: 'notes/todo.md',
        status: 'untracked'
      }
    ]);
  });
});
