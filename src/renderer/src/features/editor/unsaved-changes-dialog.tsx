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
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[28px] border border-white/10 bg-[#111317] p-5 shadow-[0_40px_120px_rgba(0,0,0,0.55)]">
        <p className="text-sm font-semibold text-white">{title}</p>
        <p className="mt-2 text-sm leading-6 text-slate-400">{body}</p>

        <div className="mt-5 flex flex-col gap-2">
          <button
            className="inline-flex w-full items-center justify-center rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSaving}
            onClick={onSave}
            type="button"
          >
            {isSaving ? 'Saving…' : confirmLabel}
          </button>
          <button
            className="inline-flex w-full items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-slate-200 transition hover:bg-white/[0.08]"
            onClick={onDiscard}
            type="button"
          >
            {discardLabel}
          </button>
          <button
            className="inline-flex w-full items-center justify-center rounded-2xl px-4 py-3 text-sm font-medium text-slate-500 transition hover:bg-white/[0.04] hover:text-slate-200"
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
