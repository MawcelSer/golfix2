import { useAuthStore } from "@/stores/auth-store";

interface GdprConsentModalProps {
  open: boolean;
  onClose: () => void;
}

export function GdprConsentModal({ open, onClose }: GdprConsentModalProps) {
  const acceptGdpr = useAuthStore((s) => s.acceptGdpr);

  if (!open) return null;

  function handleAccept() {
    acceptGdpr();
    onClose();
  }

  function handleRefuse() {
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50">
      <div className="w-full max-w-md rounded-t-2xl bg-cream p-6 text-pine">
        <h2 className="mb-4 text-lg font-semibold">Suivi GPS</h2>
        <p className="mb-6 text-sm leading-relaxed">
          Golfix utilise votre position GPS pour calculer les distances au green et suivre votre
          parcours en temps réel. Vos données de position sont traitées conformément au RGPD.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleRefuse}
            className="flex-1 rounded-lg border border-pine/20 px-4 py-3 text-sm font-medium"
          >
            Refuser
          </button>
          <button
            type="button"
            onClick={handleAccept}
            className="flex-1 rounded-lg bg-green-mid px-4 py-3 text-sm font-medium text-cream"
          >
            Accepter
          </button>
        </div>
      </div>
    </div>
  );
}
