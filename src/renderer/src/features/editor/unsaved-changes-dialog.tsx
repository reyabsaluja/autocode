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
      <div className="w-full max-w-sm animate-slide-up rounded-xl border border-white/[0.10] bg-[#1c1c1c] p-5 shadow-2xl">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-300" />
          <p className="font-geist text-[14px] font-semibold text-white/90">{title}</p>
        </div>
        <p className="mt-2 font-geist text-[13px] leading-relaxed text-white/50">{body}</p>

        <div className="mt-5 flex flex-col gap-1.5">
          <button
            className={clsx(
              'flex w-full items-center justify-center rounded-md bg-white px-4 py-2.5 font-geist text-[13px] font-semibold text-[#1c1c1c] transition',
              'hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50'
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
              'flex w-full items-center justify-center rounded-md border border-white/[0.10] bg-white/[0.04] px-4 py-2.5 font-geist text-[13px] font-medium text-white/60 transition',
              'hover:bg-white/[0.08] hover:text-white/80'
            )}
            onClick={onDiscard}
            type="button"
          >
            {discardLabel}
          </button>
          <button
            className="flex w-full items-center justify-center rounded-md px-4 py-2.5 font-geist text-[13px] font-medium text-white/30 transition hover:bg-white/[0.04] hover:text-white/50"
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
