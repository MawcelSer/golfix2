import { describe, it, expect } from "vitest";
import { computeHoleDistances } from "../distance-calculator";
import type { HoleData } from "@golfix/shared";
import type { GpsPosition } from "@/hooks/use-geolocation";

// Golf de Bordeaux-Lac approximate coordinates
const position: GpsPosition = {
  lat: 44.885,
  lng: -0.564,
  accuracy: 5,
};

function makeHole(overrides: Partial<HoleData> = {}): HoleData {
  return {
    id: "h1",
    holeNumber: 1,
    par: 4,
    strokeIndex: 1,
    distanceMeters: 380,
    teePosition: { x: -0.564, y: 44.885 },
    greenCenter: { x: -0.561, y: 44.887 },
    greenFront: { x: -0.5612, y: 44.8868 },
    greenBack: { x: -0.5608, y: 44.8872 },
    paceTargetMinutes: null,
    transitionMinutes: 3,
    hazards: [],
    ...overrides,
  };
}

describe("computeHoleDistances", () => {
  it("computes front/center/back distances as rounded meters", () => {
    const distances = computeHoleDistances(position, makeHole());

    expect(distances.front).toBeTypeOf("number");
    expect(distances.center).toBeTypeOf("number");
    expect(distances.back).toBeTypeOf("number");

    // Distances should be reasonable (100-400m for a par 4)
    expect(distances.center!).toBeGreaterThan(50);
    expect(distances.center!).toBeLessThan(500);

    // Back should be farther than front
    expect(distances.back!).toBeGreaterThan(distances.front!);
  });

  it("returns null for missing green positions", () => {
    const hole = makeHole({ greenFront: null, greenBack: null });
    const distances = computeHoleDistances(position, hole);

    expect(distances.front).toBeNull();
    expect(distances.center).not.toBeNull();
    expect(distances.back).toBeNull();
  });

  it("returns all integers (rounded)", () => {
    const distances = computeHoleDistances(position, makeHole());

    if (distances.front !== null) expect(Number.isInteger(distances.front)).toBe(true);
    if (distances.center !== null) expect(Number.isInteger(distances.center)).toBe(true);
    if (distances.back !== null) expect(Number.isInteger(distances.back)).toBe(true);
  });

  it("handles coordinate mapping correctly (x=lng, y=lat)", () => {
    // If we swap x/y, distances would be wildly different
    const hole = makeHole({
      greenCenter: { x: -0.561, y: 44.887 }, // correct: x=lng, y=lat
    });
    const correctDist = computeHoleDistances(position, hole);

    const swappedHole = makeHole({
      greenCenter: { x: 44.887, y: -0.561 }, // wrong: swapped
    });
    const swappedDist = computeHoleDistances(position, swappedHole);

    // Correct distance should be ~250m, swapped would be millions of meters
    expect(correctDist.center!).toBeLessThan(500);
    expect(swappedDist.center!).toBeGreaterThan(1000000);
  });
});
