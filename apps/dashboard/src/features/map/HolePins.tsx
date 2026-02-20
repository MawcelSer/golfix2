interface HolePin {
  holeNumber: number;
  greenCenter: { x: number; y: number } | null;
}

interface HolePinsProps {
  holes: HolePin[];
}

export function HolePins({ holes }: HolePinsProps) {
  const holesWithPos = holes.filter((h) => h.greenCenter !== null);

  if (holesWithPos.length === 0) return null;

  return (
    <>
      {holesWithPos.map((hole) => (
        <div
          key={hole.holeNumber}
          data-testid={`hole-pin-${hole.holeNumber}`}
          className="flex h-6 w-6 items-center justify-center rounded-full border border-cream/30 bg-pine text-[10px] font-bold text-cream"
          title={`Trou ${hole.holeNumber}`}
        >
          {hole.holeNumber}
        </div>
      ))}
    </>
  );
}
