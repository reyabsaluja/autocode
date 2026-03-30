import clsx from 'clsx';
import { AlertTriangle, Loader2 } from 'lucide-react';

interface UnsavedChangesDialogProps {
  body: string;
  confirmLabel?: string;
  discardLabel?: string;
  isOpen: boolean;
  isSaving?: boolean;
  onCancel: () => void;
  onDiscard: () => void;
  onSave: () => void;
  title?: string;
}

export function UnsavedChangesDialog({
  body,
  confirmLabel = 'Save and continue',
  discardLabel = 'Discard changes',
  isOpen,
  isSaving = false,
  onCancel,
  onDiscard,
  onSave,
  title = 'Unsaved changes'
}: UnsavedChangesDialogProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-4 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-sm animate-slide-up rounded-panel border border-border bg-surface-3 p-5 shadow-panel-lg">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
          <p className="text-[14px] font-semibold text-text-primary">{title}</p>
        </div>
        <p className="mt-2 text-[13px] leading-relaxed text-text-muted">{body}</p>

        <div className="mt-5 flex flex-col gap-1.5">
          <button
            className={clsx(
              'flex w-full items-center justify-center rounded-control bg-accent px-4 py-2.5 text-[13px] font-semibold text-surface-0 transition',
              'hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50'
            )}
            disabled={isSaving}
            onClick={onSave}
            type="button"
          >
            {isSaving ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
            {isSaving ? 'Saving...' : confirmLabel}
          </button>
          <button
            className={clsx(
              'flex w-full items-center justify-center rounded-control border border-border bg-white/[0.03] px-4 py-2.5 text-[13px] font-medium text-text-secondary transition',
              'hover:bg-white/[0.06] hover:text-text-primary'
            )}
            onClick={onDiscard}
            type="button"
          >
            {discardLabel}
          </button>
          <button
            className="flex w-full items-center justify-center rounded-control px-4 py-2.5 text-[13px] font-medium text-text-faint transition hover:bg-white/[0.04] hover:text-text-muted"
            onClick={onCancel}
            type="button"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
