import { useCallback, useRef, useState, type RefObject } from 'react';

import type { WorkspaceEditorHandle } from './workspace-editor-surface';

interface GuardedTransitionRequest {
  body: string;
  key: string;
  run: () => void;
  title?: string;
}

interface PendingTransition {
  body: string;
  key: string;
  title: string;
}

const DEFAULT_DIALOG_TITLE = 'Unsaved changes';

export function useUnsavedChangesGuard(editorRef: RefObject<WorkspaceEditorHandle | null>) {
  const pendingActionRef = useRef<(() => void) | null>(null);
  const [isResolvingTransition, setIsResolvingTransition] = useState(false);
  const [pendingTransition, setPendingTransition] = useState<PendingTransition | null>(null);

  const clearPendingTransition = useCallback(() => {
    pendingActionRef.current = null;
    setPendingTransition(null);
  }, []);

  const applyPendingTransition = useCallback(() => {
    const pendingAction = pendingActionRef.current;
    clearPendingTransition();
    pendingAction?.();
  }, [clearPendingTransition]);

  const requestTransition = useCallback(
    ({ body, key, run, title = DEFAULT_DIALOG_TITLE }: GuardedTransitionRequest) => {
      if (!editorRef.current?.hasUnsavedChanges()) {
        run();
        return;
      }

      // Keep project, task, and file navigation on the same save/discard/cancel path.
      setPendingTransition((current) => {
        pendingActionRef.current = run;

        if (current?.key === key) {
          return current;
        }

        return {
          body,
          key,
          title
        };
      });
    },
    [editorRef]
  );

  const handleDiscardPendingTransition = useCallback(() => {
    if (!pendingTransition) {
      return;
    }

    editorRef.current?.discardUnsavedChanges();
    applyPendingTransition();
  }, [applyPendingTransition, editorRef, pendingTransition]);

  const handleSavePendingTransition = useCallback(async () => {
    if (!pendingTransition) {
      return;
    }

    setIsResolvingTransition(true);
    const didSave = (await editorRef.current?.saveActiveFile()) ?? false;
    setIsResolvingTransition(false);

    if (!didSave) {
      return;
    }

    applyPendingTransition();
  }, [applyPendingTransition, editorRef, pendingTransition]);

  return {
    dialogProps: {
      body: pendingTransition?.body ?? '',
      isOpen: pendingTransition !== null,
      isSaving: isResolvingTransition,
      onCancel: clearPendingTransition,
      onDiscard: handleDiscardPendingTransition,
      onSave: () => {
        void handleSavePendingTransition();
      },
      title: pendingTransition?.title ?? DEFAULT_DIALOG_TITLE
    },
    requestTransition
  };
}
