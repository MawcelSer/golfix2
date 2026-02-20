import { useState } from "react";
import { apiClient, ApiError } from "@/services/api-client";
import { useToastStore } from "@/stores/toast-store";

interface SendReminderDialogProps {
  courseId: string;
  groupId: string;
  groupNumber: number;
  onClose: () => void;
}

export function SendReminderDialog({
  courseId,
  groupId,
  groupNumber,
  onClose,
}: SendReminderDialogProps) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const addToast = useToastStore((s) => s.addToast);

  async function handleSend() {
    setSending(true);
    try {
      const result = await apiClient.post<{ sent: boolean; recipientCount: number }>(
        `/courses/${courseId}/reminders/${groupId}`,
        message ? { message } : {},
      );
      addToast(
        `Rappel envoye au groupe ${groupNumber} (${result.recipientCount} joueurs)`,
        "success",
      );
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        addToast(err.message, "error");
      } else {
        addToast("Erreur lors de l'envoi du rappel", "error");
      }
      setSending(false);
    }
  }

  return (
    <div
      data-testid="reminder-dialog"
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-xl border border-cream/10 bg-pine p-6 shadow-xl">
        <h3 className="mb-4 text-lg font-semibold text-cream">
          Envoyer un rappel — Groupe {groupNumber}
        </h3>
        <textarea
          data-testid="reminder-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Message optionnel..."
          maxLength={500}
          className="mb-4 w-full rounded-lg border border-cream/10 bg-cream/5 px-3 py-2 text-sm text-cream placeholder:text-cream/30 focus:border-gold/50 focus:outline-none"
          rows={3}
        />
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-cream/60 hover:text-cream"
          >
            Annuler
          </button>
          <button
            data-testid="reminder-send-btn"
            onClick={handleSend}
            disabled={sending}
            className="rounded-lg bg-gold px-4 py-2 text-sm font-medium text-pine transition-colors hover:bg-gold/80 disabled:opacity-50"
          >
            {sending ? "Envoi..." : "Envoyer"}
          </button>
        </div>
      </div>
    </div>
  );
}
