interface HoleSelectorProps {
  currentHole: number;
  totalHoles: number;
  par: number | null;
  distanceMeters: number | null;
  onPrev: () => void;
  onNext: () => void;
}

export function HoleSelector({
  currentHole,
  totalHoles,
  par,
  distanceMeters,
  onPrev,
  onNext,
}: HoleSelectorProps) {
  return (
    <div className="flex items-center justify-between bg-pine/80 px-4 py-3 backdrop-blur-sm">
      <button
        type="button"
        onClick={onPrev}
        disabled={currentHole <= 1}
        className="flex h-9 w-9 items-center justify-center rounded-xl bg-cream/10 text-cream disabled:opacity-30"
        aria-label="Trou précédent"
      >
        ◀
      </button>

      <div className="text-center">
        <span className="font-display text-lg text-cream">
          Trou {currentHole}/{totalHoles}
        </span>
        {par != null && distanceMeters != null && (
          <p className="text-xs text-cream/50">
            Par {par} · {distanceMeters}m
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={onNext}
        disabled={currentHole >= totalHoles}
        className="flex h-9 w-9 items-center justify-center rounded-xl bg-cream/10 text-cream disabled:opacity-30"
        aria-label="Trou suivant"
      >
        ▶
      </button>
    </div>
  );
}
