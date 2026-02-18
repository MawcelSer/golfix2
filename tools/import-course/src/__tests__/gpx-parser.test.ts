import { describe, it, expect } from "vitest";
import { parseGpx } from "../gpx-parser.js";

// ── Fixtures ────────────────────────────────────────────────────────────────

function buildGpx(waypoints: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="test">
${waypoints}
</gpx>`;
}

function wpt(lat: number, lon: number, name: string): string {
  return `  <wpt lat="${lat}" lon="${lon}"><name>${name}</name></wpt>`;
}

const VALID_GPX = buildGpx(
  [
    wpt(48.8566, 2.3522, "Tee_01"),
    wpt(48.858, 2.354, "Green_01"),
    wpt(48.86, 2.356, "Tee_02"),
    wpt(48.862, 2.358, "Green_02"),
    wpt(48.857, 2.353, "Hazard_01_bunker"),
  ].join("\n"),
);

const MISSING_GREEN_GPX = buildGpx(
  [wpt(48.8566, 2.3522, "Tee_01"), wpt(48.86, 2.356, "Tee_02"), wpt(48.862, 2.358, "Green_02")].join("\n"),
);

const HAZARD_ONLY_GPX = buildGpx(
  [
    wpt(48.8566, 2.3522, "Tee_01"),
    wpt(48.858, 2.354, "Green_01"),
    wpt(48.857, 2.353, "Hazard_01_water"),
    wpt(48.856, 2.352, "Hazard_01_bunker"),
  ].join("\n"),
);

const EMPTY_GPX = buildGpx("");

// ── GPX Parser tests ─────────────────────────────────────────────────────────

describe("parseGpx", () => {
  it("parses a valid GPX file with tees and greens", () => {
    const result = parseGpx(VALID_GPX);

    expect(result.tees.size).toBe(2);
    expect(result.greens.size).toBe(2);

    const tee1 = result.tees.get(1);
    expect(tee1).toBeDefined();
    expect(tee1?.lat).toBeCloseTo(48.8566);
    expect(tee1?.lng).toBeCloseTo(2.3522);

    const green1 = result.greens.get(1);
    expect(green1).toBeDefined();
    expect(green1?.lat).toBeCloseTo(48.858);
    expect(green1?.lng).toBeCloseTo(2.354);
  });

  it("rejects GPX when a tee has no matching green", () => {
    expect(() => parseGpx(MISSING_GREEN_GPX)).toThrow(
      /missing green/i,
    );
  });

  it("parses hazards correctly", () => {
    const result = parseGpx(HAZARD_ONLY_GPX);

    expect(result.hazards).toHaveLength(2);

    const water = result.hazards.find((h) => h.type === "water");
    expect(water).toBeDefined();
    expect(water?.holeNumber).toBe(1);
    expect(water?.lat).toBeCloseTo(48.857);
    expect(water?.lng).toBeCloseTo(2.353);

    const bunker = result.hazards.find((h) => h.type === "bunker");
    expect(bunker).toBeDefined();
    expect(bunker?.type).toBe("bunker");
  });

  it("handles empty GPX gracefully (returns empty collections)", () => {
    const result = parseGpx(EMPTY_GPX);

    expect(result.tees.size).toBe(0);
    expect(result.greens.size).toBe(0);
    expect(result.hazards).toHaveLength(0);
  });

  it("ignores waypoints with unrecognised naming conventions", () => {
    const gpx = buildGpx(
      [
        wpt(48.8566, 2.3522, "Tee_01"),
        wpt(48.858, 2.354, "Green_01"),
        wpt(48.857, 2.353, "Clubhouse"),
        wpt(48.856, 2.352, "Parking"),
      ].join("\n"),
    );

    const result = parseGpx(gpx);
    expect(result.tees.size).toBe(1);
    expect(result.greens.size).toBe(1);
    expect(result.hazards).toHaveLength(0);
  });
});
