interface DistanceTriptychProps {
  front: number | null;
  center: number | null;
  back: number | null;
}

export function DistanceTriptych({ front, center, back }: DistanceTriptychProps) {
  return (
    <div className="flex items-end justify-around rounded-2xl bg-cream/5 px-4 py-4">
      <div className="flex flex-col items-center">
        <span className="text-xs uppercase tracking-widest text-cream/50">Avant</span>
        <span className="mt-1 font-mono text-2xl text-cream/80">
          {front !== null ? front : "—"}
        </span>
      </div>

      <div className="flex flex-col items-center">
        <span className="text-xs uppercase tracking-widest text-cream/50">Centre</span>
        <span className="mt-1 font-mono text-4xl font-medium text-cream">
          {center !== null ? (
            <>
              {center}
              <span className="text-lg text-cream/60">m</span>
            </>
          ) : (
            "—"
          )}
        </span>
      </div>

      <div className="flex flex-col items-center">
        <span className="text-xs uppercase tracking-widest text-cream/50">Arrière</span>
        <span className="mt-1 font-mono text-2xl text-cream/80">{back !== null ? back : "—"}</span>
      </div>
    </div>
  );
}
