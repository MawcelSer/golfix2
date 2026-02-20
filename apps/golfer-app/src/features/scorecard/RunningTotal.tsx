import { useMemo } from "react";
import type { HoleData } from "@golfix/shared";
import type { LocalScore } from "@/stores/round-store";

interface RunningTotalProps {
  scores: Map<number, LocalScore>;
  holes: HoleData[];
}

function formatVsPar(totalStrokes: number, totalPar: number): string {
  const diff = totalStrokes - totalPar;
  if (diff === 0) return "E";
  return diff > 0 ? `+${diff}` : `${diff}`;
}

export function RunningTotal({ scores, holes }: RunningTotalProps) {
  const { totalStrokes, totalPar, holesPlayed } = useMemo(() => {
    let strokes = 0;
    let par = 0;
    let played = 0;

    for (const hole of holes) {
      const score = scores.get(hole.holeNumber);
      if (score) {
        strokes += score.strokes;
        par += hole.par;
        played++;
      }
    }

    return { totalStrokes: strokes, totalPar: par, holesPlayed: played };
  }, [scores, holes]);

  if (holesPlayed === 0) {
    return (
      <div className="mx-4 flex items-center justify-center gap-4 rounded-2xl bg-cream/5 px-4 py-4">
        <span className="text-sm text-cream/50">Total</span>
        <span className="font-mono text-lg font-bold text-cream">—</span>
      </div>
    );
  }

  const vsPar = formatVsPar(totalStrokes, totalPar);
  const vsParColor =
    totalStrokes === totalPar
      ? "text-cream"
      : totalStrokes < totalPar
        ? "text-green-light"
        : "text-gold";

  return (
    <div className="mx-4 flex items-center justify-center gap-4 rounded-2xl bg-cream/5 px-4 py-4">
      <span className="text-sm text-cream/50">{holesPlayed} trous</span>
      <span className="font-mono text-lg font-bold text-cream">{totalStrokes}</span>
      <span className={`font-display text-lg ${vsParColor}`}>{vsPar}</span>
    </div>
  );
}
