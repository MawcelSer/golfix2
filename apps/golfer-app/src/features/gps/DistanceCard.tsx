interface DistanceCardProps {
  label: string;
  distance: number | null;
  variant?: "primary" | "secondary";
}

export function DistanceCard({ label, distance, variant = "secondary" }: DistanceCardProps) {
  const isPrimary = variant === "primary";

  return (
    <div
      className={`flex items-center justify-between rounded-xl px-5 ${
        isPrimary ? "bg-green-mid py-5" : "bg-cream/5 py-3"
      }`}
    >
      <span className={`text-sm font-medium ${isPrimary ? "text-cream" : "text-cream/70"}`}>
        {label}
      </span>
      <span
        className={`font-mono font-semibold ${
          isPrimary ? "text-3xl text-cream" : "text-xl text-cream/90"
        }`}
      >
        {distance !== null ? `${distance} m` : "—"}
      </span>
    </div>
  );
}
