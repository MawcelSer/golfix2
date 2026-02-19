import type { HoleData } from "@golfix/shared";
import type { LocalScore } from "@/stores/round-store";

export interface HoleDetail {
  holeNumber: number;
  par: number;
  strokes: number;
  vsPar: number;
  putts: number;
  fairwayHit: boolean | null;
  greenInRegulation: boolean | null;
}

export interface RoundStats {
  totalStrokes: number;
  totalPar: number;
  vsPar: number;
  totalPutts: number;
  holesPlayed: number;
  firPercent: number | null;
  girPercent: number | null;
  holeDetails: HoleDetail[];
}

export function computeRoundStats(scores: Map<number, LocalScore>, holes: HoleData[]): RoundStats {
  let totalStrokes = 0;
  let totalPar = 0;
  let totalPutts = 0;
  let holesPlayed = 0;
  let firHit = 0;
  let firTracked = 0;
  let girHit = 0;
  let girTracked = 0;
  const holeDetails: HoleDetail[] = [];

  for (const hole of holes) {
    const score = scores.get(hole.holeNumber);
    if (!score) continue;

    holesPlayed++;
    totalStrokes += score.strokes;
    totalPar += hole.par;
    totalPutts += score.putts;

    // FIR only counts on par 4+ holes where the golfer recorded a value
    if (hole.par >= 4 && score.fairwayHit !== null) {
      firTracked++;
      if (score.fairwayHit) firHit++;
    }

    // GIR counts on all holes where the golfer recorded a value
    if (score.greenInRegulation !== null) {
      girTracked++;
      if (score.greenInRegulation) girHit++;
    }

    holeDetails.push({
      holeNumber: hole.holeNumber,
      par: hole.par,
      strokes: score.strokes,
      vsPar: score.strokes - hole.par,
      putts: score.putts,
      fairwayHit: score.fairwayHit,
      greenInRegulation: score.greenInRegulation,
    });
  }

  return {
    totalStrokes,
    totalPar,
    vsPar: totalStrokes - totalPar,
    totalPutts,
    holesPlayed,
    firPercent: firTracked > 0 ? (firHit / firTracked) * 100 : null,
    girPercent: girTracked > 0 ? (girHit / girTracked) * 100 : null,
    holeDetails,
  };
}
