import { describe, it, expect } from "vitest";
import { computeRoundStats } from "../compute-stats";
import type { HoleData } from "@golfix/shared";
import type { LocalScore } from "@/stores/round-store";

function makeHole(num: number, par: number): HoleData {
  return {
    id: `h${num}`,
    holeNumber: num,
    par,
    strokeIndex: num,
    distanceMeters: 350,
    teePosition: null,
    greenCenter: null,
    greenFront: null,
    greenBack: null,
    paceTargetMinutes: null,
    transitionMinutes: 3,
    hazards: [],
  };
}

function makeScore(
  strokes: number,
  putts: number,
  fir: boolean | null,
  gir: boolean | null,
): LocalScore {
  return { strokes, putts, fairwayHit: fir, greenInRegulation: gir, synced: false };
}

describe("computeRoundStats", () => {
  it("computes totals for a complete 18-hole round", () => {
    const holes = Array.from({ length: 18 }, (_, i) => makeHole(i + 1, i < 4 ? 3 : 4));
    const scores = new Map<number, LocalScore>();
    // Par 3 holes: score 3
    for (let i = 1; i <= 4; i++) scores.set(i, makeScore(3, 2, null, true));
    // Par 4 holes: score 5
    for (let i = 5; i <= 18; i++) scores.set(i, makeScore(5, 2, true, false));

    const stats = computeRoundStats(scores, holes);

    expect(stats.totalStrokes).toBe(3 * 4 + 5 * 14); // 12 + 70 = 82
    expect(stats.totalPar).toBe(3 * 4 + 4 * 14); // 12 + 56 = 68
    expect(stats.vsPar).toBe(14);
    expect(stats.totalPutts).toBe(36);
    expect(stats.holesPlayed).toBe(18);
  });

  it("computes FIR percentage (only par 4+ holes)", () => {
    const holes = [makeHole(1, 3), makeHole(2, 4), makeHole(3, 4), makeHole(4, 5)];
    const scores = new Map<number, LocalScore>();
    scores.set(1, makeScore(3, 1, true, true)); // par 3 — FIR not counted
    scores.set(2, makeScore(4, 2, true, true)); // par 4, FIR hit
    scores.set(3, makeScore(5, 2, false, false)); // par 4, FIR miss
    scores.set(4, makeScore(5, 2, true, true)); // par 5, FIR hit

    const stats = computeRoundStats(scores, holes);

    // 2 FIR hits out of 3 par 4+ holes = 66.7%
    expect(stats.firPercent).toBeCloseTo(66.7, 0);
  });

  it("computes GIR percentage (all holes)", () => {
    const holes = [makeHole(1, 3), makeHole(2, 4), makeHole(3, 4)];
    const scores = new Map<number, LocalScore>();
    scores.set(1, makeScore(3, 1, null, true));
    scores.set(2, makeScore(4, 2, true, true));
    scores.set(3, makeScore(5, 2, true, false));

    const stats = computeRoundStats(scores, holes);

    // 2 GIR out of 3 holes = 66.7%
    expect(stats.girPercent).toBeCloseTo(66.7, 0);
  });

  it("handles null FIR/GIR as not counted", () => {
    const holes = [makeHole(1, 4), makeHole(2, 4)];
    const scores = new Map<number, LocalScore>();
    scores.set(1, makeScore(4, 2, true, null)); // FIR yes, GIR null
    scores.set(2, makeScore(4, 2, null, true)); // FIR null, GIR yes

    const stats = computeRoundStats(scores, holes);

    // FIR: 1 hit / 1 tracked = 100%
    expect(stats.firPercent).toBe(100);
    // GIR: 1 hit / 1 tracked = 100%
    expect(stats.girPercent).toBe(100);
  });

  it("returns zeros for empty scores", () => {
    const holes = [makeHole(1, 4)];
    const scores = new Map<number, LocalScore>();

    const stats = computeRoundStats(scores, holes);

    expect(stats.totalStrokes).toBe(0);
    expect(stats.holesPlayed).toBe(0);
    expect(stats.firPercent).toBeNull();
    expect(stats.girPercent).toBeNull();
  });

  it("builds per-hole breakdown", () => {
    const holes = [makeHole(1, 4), makeHole(2, 3)];
    const scores = new Map<number, LocalScore>();
    scores.set(1, makeScore(5, 2, true, false));
    scores.set(2, makeScore(3, 1, null, true));

    const stats = computeRoundStats(scores, holes);

    expect(stats.holeDetails).toHaveLength(2);
    expect(stats.holeDetails[0]).toEqual({
      holeNumber: 1,
      par: 4,
      strokes: 5,
      vsPar: 1,
      putts: 2,
      fairwayHit: true,
      greenInRegulation: false,
    });
    expect(stats.holeDetails[1]).toEqual({
      holeNumber: 2,
      par: 3,
      strokes: 3,
      vsPar: 0,
      putts: 1,
      fairwayHit: null,
      greenInRegulation: true,
    });
  });
});
