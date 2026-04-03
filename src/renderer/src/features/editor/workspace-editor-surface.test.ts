import { describe, expect, test } from 'bun:test';

import { resolveWorkspaceEditorSyncState } from './workspace-editor-sync';

describe('workspace editor sync state', () => {
  test('stays clear when disk still matches the saved baseline', () => {
    expect(
      resolveWorkspaceEditorSyncState({
        bufferContent: 'draft',
        isDirty: true,
        lastSavedContent: 'saved',
        latestContent: 'saved'
      })
    ).toEqual({
      didDiskCatchUp: false,
      hasExternalConflict: false
    });
  });

  test('detects when disk catches up to the current buffer', () => {
    expect(
      resolveWorkspaceEditorSyncState({
        bufferContent: 'draft',
        isDirty: true,
        lastSavedContent: 'saved',
        latestContent: 'draft'
      })
    ).toEqual({
      didDiskCatchUp: true,
      hasExternalConflict: false
    });
  });

  test('flags a conflict when disk changes to different content', () => {
    expect(
      resolveWorkspaceEditorSyncState({
        bufferContent: 'draft',
        isDirty: true,
        lastSavedContent: 'saved',
        latestContent: 'agent edit'
      })
    ).toEqual({
      didDiskCatchUp: false,
      hasExternalConflict: true
    });
  });
});
