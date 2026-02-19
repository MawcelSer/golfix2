interface StatToggleProps {
  label: string;
  value: boolean | null;
  onChange: (value: boolean | null) => void;
}

function nextState(current: boolean | null): boolean | null {
  if (current === null) return true;
  if (current === true) return false;
  return null;
}

export function StatToggle({ label, value, onChange }: StatToggleProps) {
  const displayText = value === null ? "—" : value ? "Oui" : "Non";

  const colorClass =
    value === null
      ? "bg-cream/10 text-cream/50"
      : value
        ? "bg-green-mid/30 text-green-light"
        : "bg-cream/5 text-cream/40";

  return (
    <button
      type="button"
      onClick={() => onChange(nextState(value))}
      className={`flex items-center gap-2 rounded-lg px-3 py-2 ${colorClass}`}
      aria-label={`${label} : ${displayText}`}
    >
      <span className="text-sm text-cream/70">{label}</span>
      <span className="text-sm font-medium">{displayText}</span>
    </button>
  );
}
