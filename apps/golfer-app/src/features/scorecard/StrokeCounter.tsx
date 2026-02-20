interface StrokeCounterProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}

export function StrokeCounter({ label, value, min, max, onChange }: StrokeCounterProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-16 text-sm text-cream/70">{label}</span>

      <button
        type="button"
        onClick={() => onChange(value - 1)}
        disabled={value <= min}
        className="flex h-11 w-11 items-center justify-center rounded-xl bg-cream/10 text-lg text-cream disabled:opacity-30"
        aria-label={`Diminuer ${label}`}
      >
        −
      </button>

      <span className="w-8 text-center font-mono text-xl font-bold text-cream">{value}</span>

      <button
        type="button"
        onClick={() => onChange(value + 1)}
        disabled={value >= max}
        className="flex h-11 w-11 items-center justify-center rounded-xl bg-cream/10 text-lg text-cream disabled:opacity-30"
        aria-label={`Augmenter ${label}`}
      >
        +
      </button>
    </div>
  );
}
