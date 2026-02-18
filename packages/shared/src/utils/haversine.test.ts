import { describe, expect, test } from "vitest";
import { haversineDistance } from "./haversine";

describe("haversineDistance", () => {
  test("returns 0 for identical points", () => {
    expect(haversineDistance(48.8566, 2.3522, 48.8566, 2.3522)).toBe(0);
  });

  test("computes distance between Paris and London (~343 km)", () => {
    const distance = haversineDistance(48.8566, 2.3522, 51.5074, -0.1278);
    expect(distance).toBeGreaterThan(340_000);
    expect(distance).toBeLessThan(346_000);
  });

  test("computes short golf distance (~150m between tee and green)", () => {
    // Two points on a golf course ~150m apart
    const lat1 = 48.8566;
    const lng1 = 2.3522;
    const lat2 = 48.8579; // ~145m north
    const lng2 = 2.3522;
    const distance = haversineDistance(lat1, lng1, lat2, lng2);
    expect(distance).toBeGreaterThan(140);
    expect(distance).toBeLessThan(150);
  });

  test("is symmetric", () => {
    const d1 = haversineDistance(48.8566, 2.3522, 51.5074, -0.1278);
    const d2 = haversineDistance(51.5074, -0.1278, 48.8566, 2.3522);
    expect(d1).toBeCloseTo(d2, 6);
  });
});
