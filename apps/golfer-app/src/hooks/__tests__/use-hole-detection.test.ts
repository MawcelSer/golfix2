import { describe, it, expect, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import type { HoleData } from "@golfix/shared";
import type { GpsPosition } from "../use-geolocation";
import { useHoleDetection } from "../use-hole-detection";

// Test course near Bordeaux
const TEE_1 = { x: -0.564, y: 44.885 }; // hole 1 tee
const TEE_2 = { x: -0.56, y: 44.89 }; // hole 2 tee (500m+ away)
const GREEN_1 = { x: -0.561, y: 44.887 }; // hole 1 green

function makeHoles(): HoleData[] {
  return [
    {
      id: "h1",
      holeNumber: 1,
      par: 4,
      strokeIndex: 1,
      distanceMeters: 380,
      teePosition: TEE_1,
      greenCenter: GREEN_1,
      greenFront: null,
      greenBack: null,
      paceTargetMinutes: null,
      transitionMinutes: 3,
      hazards: [],
    },
    {
      id: "h2",
      holeNumber: 2,
      par: 3,
      strokeIndex: 2,
      distanceMeters: 150,
      teePosition: TEE_2,
      greenCenter: { x: -0.558, y: 44.891 },
      greenFront: null,
      greenBack: null,
      paceTargetMinutes: null,
      transitionMinutes: 3,
      hazards: [],
    },
  ];
}

// Position near hole 1 tee (~10m away)
const nearTee1: GpsPosition = { lat: 44.8851, lng: -0.5641, accuracy: 5 };
// Position near hole 2 tee (~10m away)
const nearTee2: GpsPosition = { lat: 44.8901, lng: -0.5601, accuracy: 5 };
// Position near hole 1 green (~15m away)
const nearGreen1: GpsPosition = { lat: 44.8869, lng: -0.5611, accuracy: 5 };
// Position far from all tees
const farAway: GpsPosition = { lat: 44.9, lng: -0.55, accuracy: 5 };

describe("useHoleDetection", () => {
  afterEach(cleanup);

  it("detects hole based on proximity to tee (with hysteresis)", () => {
    const holes = makeHoles();
    const { result, rerender } = renderHook(({ pos }) => useHoleDetection(pos, holes), {
      initialProps: { pos: nearTee2 as GpsPosition | null },
    });

    // First update — candidate but not yet confirmed
    expect(result.current.detectedHole).toBe(1); // default

    // Second update — hysteresis met
    rerender({ pos: { ...nearTee2, accuracy: 6 } });
    expect(result.current.detectedHole).toBe(2);
  });

  it("requires 2 consecutive matches (hysteresis)", () => {
    const holes = makeHoles();
    const { result, rerender } = renderHook(({ pos }) => useHoleDetection(pos, holes), {
      initialProps: { pos: nearTee2 as GpsPosition | null },
    });

    // 1st: near hole 2 — candidate
    expect(result.current.detectedHole).toBe(1);

    // Switch to hole 1 — resets candidate
    rerender({ pos: nearTee1 });
    expect(result.current.detectedHole).toBe(1); // already on 1, no change

    // Back to hole 2 — reset candidate again
    rerender({ pos: nearTee2 });
    expect(result.current.detectedHole).toBe(1); // only 1 count

    // Second consecutive near hole 2 — now switches
    rerender({ pos: { ...nearTee2, accuracy: 7 } });
    expect(result.current.detectedHole).toBe(2);
  });

  it("does not switch when between tees (too far from all)", () => {
    const holes = makeHoles();
    const { result, rerender } = renderHook(({ pos }) => useHoleDetection(pos, holes), {
      initialProps: { pos: farAway as GpsPosition | null },
    });

    expect(result.current.detectedHole).toBe(1);
    rerender({ pos: { ...farAway, accuracy: 6 } });
    expect(result.current.detectedHole).toBe(1);
  });

  it("detects nearGreen when close to current hole green", () => {
    const holes = makeHoles();
    const { result } = renderHook(({ pos }) => useHoleDetection(pos, holes), {
      initialProps: { pos: nearGreen1 as GpsPosition | null },
    });

    expect(result.current.nearGreen).toBe(true);
  });

  it("manual override disables auto-detection", () => {
    const holes = makeHoles();
    const { result, rerender } = renderHook(({ pos }) => useHoleDetection(pos, holes), {
      initialProps: { pos: nearTee2 as GpsPosition | null },
    });

    // Manually select hole 1
    act(() => {
      result.current.setManualHole(1);
    });

    // Even with 2 updates near hole 2, stays on 1 (manual override active)
    rerender({ pos: nearTee2 });
    rerender({ pos: { ...nearTee2, accuracy: 6 } });
    expect(result.current.detectedHole).toBe(1);
  });

  it("defaults to specified hole number", () => {
    const holes = makeHoles();
    const { result } = renderHook(() => useHoleDetection(null, holes, 5));

    expect(result.current.detectedHole).toBe(5);
  });

  it("handles holes with null teePosition", () => {
    const holes = makeHoles();
    const holesWithNullTee = [{ ...holes[0]!, teePosition: null }, holes[1]!];

    const { result, rerender } = renderHook(({ pos }) => useHoleDetection(pos, holesWithNullTee), {
      initialProps: { pos: nearTee2 as GpsPosition | null },
    });

    rerender({ pos: { ...nearTee2, accuracy: 6 } });
    // Should detect hole 2 (only one with tee position)
    expect(result.current.detectedHole).toBe(2);
  });
});
