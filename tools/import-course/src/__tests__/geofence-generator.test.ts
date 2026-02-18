import { describe, it, expect } from "vitest";
import { generateGeofence } from "../geofence-generator.js";

// ── Fixtures ─────────────────────────────────────────────────────────────────

// Two points ~150m apart (roughly)
const TEE = { lat: 48.8566, lng: 2.3522 };
const GREEN = { lat: 48.858, lng: 2.354 };

// Two points very close together (~20m) — should trigger minimum buffer of 100m
const TEE_CLOSE = { lat: 48.8566, lng: 2.3522 };
const GREEN_CLOSE = { lat: 48.85662, lng: 2.35222 };

// ── Geofence Generator tests ──────────────────────────────────────────────────

describe("generateGeofence", () => {
  it("returns a valid EWKT polygon string", () => {
    const ewkt = generateGeofence(TEE, GREEN);

    expect(ewkt).toMatch(/^SRID=4326;POLYGON\(\(/);
    expect(ewkt).toMatch(/\)\)$/);
  });

  it("generates a closed ring with exactly 5 coordinate pairs", () => {
    const ewkt = generateGeofence(TEE, GREEN);

    // Extract the coordinate list between POLYGON(( and ))
    const match = ewkt.match(/POLYGON\(\((.+)\)\)/);
    expect(match).not.toBeNull();

    const coords = (match?.[1] ?? "").split(",").map((s) => s.trim());
    // A closed ring has first === last, giving 5 pairs for a rectangle
    expect(coords).toHaveLength(5);
  });

  it("first and last coordinate pair are identical (closed ring)", () => {
    const ewkt = generateGeofence(TEE, GREEN);

    const match = ewkt.match(/POLYGON\(\((.+)\)\)/);
    const coords = (match?.[1] ?? "").split(",").map((s) => s.trim());

    expect(coords[0]).toBe(coords[4]);
  });

  it("uses at least 100m buffer even for very short holes", () => {
    const ewkt = generateGeofence(TEE_CLOSE, GREEN_CLOSE);

    // Extract corners and verify the polygon spans at least ~100m in each direction.
    // 100m in degrees ≈ 0.0009° latitude
    const match = ewkt.match(/POLYGON\(\((.+)\)\)/);
    const coords = (match?.[1] ?? "").split(",").map((s) => {
      const parts = s.trim().split(" ");
      return { lng: parseFloat(parts[0] ?? "0"), lat: parseFloat(parts[1] ?? "0") };
    });

    const lats = coords.map((c) => c.lat);
    const lngs = coords.map((c) => c.lng);
    const latSpan = Math.max(...lats) - Math.min(...lats);
    const lngSpan = Math.max(...lngs) - Math.min(...lngs);

    // 100m buffer should produce spans > 0.001° in each direction
    expect(latSpan).toBeGreaterThan(0.001);
    expect(lngSpan).toBeGreaterThan(0.001);
  });

  it("all coordinate values are finite numbers", () => {
    const ewkt = generateGeofence(TEE, GREEN);

    const match = ewkt.match(/POLYGON\(\((.+)\)\)/);
    const coords = (match?.[1] ?? "").split(",").flatMap((s) => s.trim().split(" ").map(Number));

    for (const v of coords) {
      expect(isFinite(v)).toBe(true);
    }
  });
});
