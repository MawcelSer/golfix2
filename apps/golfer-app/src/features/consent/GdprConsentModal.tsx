import { useAuthStore } from "@/stores/auth-store";

interface GdprConsentModalProps {
  open: boolean;
  onClose: (accepted: boolean) => void;
}

export function GdprConsentModal({ open, onClose }: GdprConsentModalProps) {
  const acceptGdpr = useAuthStore((s) => s.acceptGdpr);

  if (!open) return null;

  function handleAccept() {
    acceptGdpr();
    onClose(true);
  }

  function handleRefuse() {
    onClose(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-t-2xl border-t border-cream/10 bg-pine p-6 text-cream">
        <h2 className="mb-4 font-display text-xl">Suivi GPS</h2>
        <p className="mb-6 text-sm leading-relaxed text-cream/70">
          Golfix utilise votre position GPS pour calculer les distances au green et suivre votre
          parcours en temps réel. Vos données de position sont traitées conformément au RGPD.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleRefuse}
            className="flex-1 rounded-xl border border-cream/20 px-4 py-3 text-sm font-medium text-cream"
          >
            Refuser
          </button>
          <button
            type="button"
            onClick={handleAccept}
            className="flex-1 rounded-xl bg-green-mid px-4 py-3 text-sm font-medium text-cream"
          >
            Accepter
          </button>
        </div>
      </div>
    </div>
  );
}
