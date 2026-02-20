interface InstallBannerProps {
  onInstall: () => void;
  onDismiss: () => void;
}

export function InstallBanner({ onInstall, onDismiss }: InstallBannerProps) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-cream/10 bg-cream/5 px-4 py-3">
      <img src="/icons/app-logo.png" alt="" className="h-8 w-8" />
      <p className="flex-1 text-sm font-medium text-cream">Installer Golfix</p>
      <button
        type="button"
        onClick={onInstall}
        className="rounded-xl bg-green-mid px-4 py-2 text-sm font-medium text-cream"
      >
        Installer
      </button>
      <button type="button" onClick={onDismiss} aria-label="Fermer" className="p-2 text-cream/40">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path
            d="M1 1l12 12M13 1L1 13"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}
