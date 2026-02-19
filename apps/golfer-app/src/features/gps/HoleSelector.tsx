interface HoleSelectorProps {
  currentHole: number;
  totalHoles: number;
  onPrev: () => void;
  onNext: () => void;
}

export function HoleSelector({ currentHole, totalHoles, onPrev, onNext }: HoleSelectorProps) {
  return (
    <div className="flex items-center justify-between px-6 py-3">
      <button
        type="button"
        onClick={onPrev}
        disabled={currentHole <= 1}
        className="rounded-lg bg-cream/10 px-4 py-2 text-cream disabled:opacity-30"
        aria-label="Trou précédent"
      >
        ◀
      </button>

      <span className="text-lg font-medium text-cream">
        Trou {currentHole}/{totalHoles}
      </span>

      <button
        type="button"
        onClick={onNext}
        disabled={currentHole >= totalHoles}
        className="rounded-lg bg-cream/10 px-4 py-2 text-cream disabled:opacity-30"
        aria-label="Trou suivant"
      >
        ▶
      </button>
    </div>
  );
}
