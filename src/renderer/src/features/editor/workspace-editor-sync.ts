export function resolveWorkspaceEditorSyncState(input: {
  bufferContent: string;
  isDirty: boolean;
  lastSavedContent: string;
  latestContent: string;
}) {
  if (!input.isDirty || input.latestContent === input.lastSavedContent) {
    return {
      didDiskCatchUp: false,
      hasExternalConflict: false
    };
  }

  if (input.latestContent === input.bufferContent) {
    return {
      didDiskCatchUp: true,
      hasExternalConflict: false
    };
  }

  return {
    didDiskCatchUp: false,
    hasExternalConflict: true
  };
}

export function resolveLatestWorkspaceFileContent(
  latestContent: string | null | undefined,
  fallbackContent: string
) {
  return latestContent ?? fallbackContent;
}
