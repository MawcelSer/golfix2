interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="mx-6 w-full max-w-sm rounded-2xl border border-cream/10 bg-pine p-6">
        <h2 className="font-display text-xl text-cream">{title}</h2>
        {message && <p className="mt-2 text-sm text-cream/70">{message}</p>}
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-cream/20 px-4 py-3 text-sm font-medium text-cream"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 rounded-xl bg-green-mid px-4 py-3 text-sm font-medium text-cream"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
