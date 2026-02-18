import { describe, expect, it } from "vitest";

import {
  computeHole,
  createRng,
  gaussianNoise,
  generateHoleWaypoints,
  haversineDistance,
  targetMinutesForPar,
} from "../path-generator";

describe("targetMinutesForPar", () => {
  it("returns 10 for par 3", () => expect(targetMinutesForPar(3)).toBe(10));
  it("returns 14 for par 4", () => expect(targetMinutesForPar(4)).toBe(14));
  it("returns 17 for par 5", () => expect(targetMinutesForPar(5)).toBe(17));
  it("returns 14 for unknown par", () => expect(targetMinutesForPar(6)).toBe(14));
});

describe("haversineDistance", () => {
  it("returns 0 for identical points", () => {
    expect(haversineDistance(44.84, -0.58, 44.84, -0.58)).toBe(0);
  });

  it("calculates known distance approximately correctly", () => {
    // ~111km per degree of latitude
    const dist = haversineDistance(44.0, -0.58, 45.0, -0.58);
    expect(dist).toBeGreaterThan(110_000);
    expect(dist).toBeLessThan(112_000);
  });
});

describe("createRng", () => {
  it("produces deterministic output for same seed", () => {
    const rng1 = createRng(42);
    const rng2 = createRng(42);
    const values1 = Array.from({ length: 10 }, () => rng1());
    const values2 = Array.from({ length: 10 }, () => rng2());
    expect(values1).toEqual(values2);
  });

  it("produces values between 0 and 1", () => {
    const rng = createRng(123);
    for (let i = 0; i < 100; i++) {
      const val = rng();
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(1);
    }
  });

  it("produces different output for different seeds", () => {
    const rng1 = createRng(1);
    const rng2 = createRng(2);
    expect(rng1()).not.toBe(rng2());
  });
});

describe("gaussianNoise", () => {
  it("has mean close to 0 over many samples", () => {
    const rng = createRng(42);
    const samples = Array.from({ length: 1000 }, () => gaussianNoise(rng, 10));
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    expect(Math.abs(mean)).toBeLessThan(2); // within 2 units
  });
});

describe("computeHole", () => {
  it("computes green position from tee and distance", () => {
    const hole = computeHole({
      num: 1, par: 4, si: 7, dist: 365,
      lat: 44.8392, lng: -0.581, transition: 1,
    });

    expect(hole.greenLat).toBeGreaterThan(hole.lat);
    expect(hole.greenLng).toBeGreaterThan(hole.lng);
    expect(hole.targetMinutes).toBe(14); // par 4
  });
});

describe("generateHoleWaypoints", () => {
  const hole = computeHole({
    num: 1, par: 4, si: 7, dist: 365,
    lat: 44.8392, lng: -0.581, transition: 1,
  });

  it("generates correct number of waypoints", () => {
    const playTimeMs = 14 * 60_000; // 14 min
    const intervalMs = 5000;
    const rng = createRng(42);
    const waypoints = generateHoleWaypoints(hole, playTimeMs, new Date(), intervalMs, rng);

    const expected = Math.ceil(playTimeMs / intervalMs);
    expect(waypoints.length).toBe(expected);
  });

  it("starts near the tee position", () => {
    const rng = createRng(42);
    const waypoints = generateHoleWaypoints(
      hole, 14 * 60_000, new Date(), 5000, rng,
    );
    const first = waypoints[0]!;

    const distFromTee = haversineDistance(first.lat, first.lng, hole.lat, hole.lng);
    expect(distFromTee).toBeLessThan(50); // within 50m (GPS noise)
  });

  it("ends near the green position", () => {
    const rng = createRng(42);
    const waypoints = generateHoleWaypoints(
      hole, 14 * 60_000, new Date(), 5000, rng,
    );
    const last = waypoints[waypoints.length - 1]!;

    const distFromGreen = haversineDistance(
      last.lat, last.lng, hole.greenLat, hole.greenLng,
    );
    expect(distFromGreen).toBeLessThan(50); // within 50m (GPS noise)
  });

  it("has timestamps spanning the play time", () => {
    const playTimeMs = 14 * 60_000;
    const start = new Date("2024-01-15T08:00:00Z");
    const rng = createRng(42);
    const waypoints = generateHoleWaypoints(hole, playTimeMs, start, 5000, rng);

    const first = waypoints[0]!;
    const last = waypoints[waypoints.length - 1]!;

    expect(first.recordedAt.getTime()).toBe(start.getTime());
    expect(last.recordedAt.getTime()).toBeCloseTo(
      start.getTime() + playTimeMs,
      -2, // within 10ms
    );
  });

  it("has accuracy values between 5 and 15", () => {
    const rng = createRng(42);
    const waypoints = generateHoleWaypoints(
      hole, 14 * 60_000, new Date(), 5000, rng,
    );

    for (const wp of waypoints) {
      expect(wp.accuracy).toBeGreaterThanOrEqual(5);
      expect(wp.accuracy).toBeLessThan(16);
    }
  });

  it("is deterministic with same RNG seed", () => {
    const start = new Date("2024-01-15T08:00:00Z");
    const rng1 = createRng(42);
    const rng2 = createRng(42);

    const wp1 = generateHoleWaypoints(hole, 14 * 60_000, start, 5000, rng1);
    const wp2 = generateHoleWaypoints(hole, 14 * 60_000, start, 5000, rng2);

    expect(wp1.length).toBe(wp2.length);
    expect(wp1[0]!.lat).toBe(wp2[0]!.lat);
    expect(wp1[0]!.lng).toBe(wp2[0]!.lng);
  });
});
