import { describe, it, expect } from "vitest";
import {
  calculatePaceStatus,
  calculateProjectedFinish,
  updateGroupHole,
  startPaceClock,
} from "../pace-calculator";
import { createGroupState, type HoleData } from "../pace-types";

// ── Test Helpers ────────────────────────────────────────────────────

function makeHoles(count = 18): HoleData[] {
  // Typical par-72 course: 4,3,5,4,4,3,4,5,4,4,3,5,4,4,3,4,5,4
  const pars = [4, 3, 5, 4, 4, 3, 4, 5, 4, 4, 3, 5, 4, 4, 3, 4, 5, 4];
  return pars.slice(0, count).map((par, i) => ({
    holeNumber: i + 1,
    par,
    paceTargetMinutes: null, // use defaults
    transitionMinutes: i === 6 ? 3 : i === count - 1 ? 0 : 1, // Hole 7→8 has 3 min
  }));
}

function minutesAfter(base: Date, minutes: number): Date {
  return new Date(base.getTime() + minutes * 60000);
}

const BASE_TIME = new Date("2026-03-15T08:00:00Z");

// ── Tests ───────────────────────────────────────────────────────────

describe("calculatePaceStatus", () => {
  const holes = makeHoles();

  it("returns on_pace for FORMING group", () => {
    const group = createGroupState("g-1", 1);
    const result = calculatePaceStatus(group, holes, BASE_TIME);

    expect(result.status).toBe("on_pace");
    expect(result.deltaMinutes).toBe(0);
  });

  it("returns on_pace when exactly on schedule", () => {
    const group = createGroupState("g-1", 1);
    group.state = "PLAYING";
    group.currentHole = 1;
    group.paceStartTime = BASE_TIME;

    // Hole 1: par 4 → 14 min play + 1 min transition = 15 min expected
    const now = minutesAfter(BASE_TIME, 15);
    const result = calculatePaceStatus(group, holes, now);

    expect(result.status).toBe("on_pace");
    expect(Math.abs(result.deltaMinutes)).toBeLessThan(0.1);
  });

  it("returns ahead when > 3 min ahead", () => {
    const group = createGroupState("g-1", 1);
    group.state = "PLAYING";
    group.currentHole = 3;
    group.paceStartTime = BASE_TIME;

    // Expected at hole 3: 15 + 11 + 19 = 45 min
    // If only 40 min elapsed → delta = -5 → ahead
    const now = minutesAfter(BASE_TIME, 40);
    const result = calculatePaceStatus(group, holes, now);

    expect(result.status).toBe("ahead");
    expect(result.deltaMinutes).toBeLessThan(-3);
  });

  it("returns attention when 3-8 min behind", () => {
    const group = createGroupState("g-1", 1);
    group.state = "PLAYING";
    group.currentHole = 3;
    group.paceStartTime = BASE_TIME;

    // Expected at hole 3 = 45 min. If 50 min elapsed → delta = +5 → attention
    const now = minutesAfter(BASE_TIME, 50);
    const result = calculatePaceStatus(group, holes, now);

    expect(result.status).toBe("attention");
    expect(result.deltaMinutes).toBeGreaterThan(3);
    expect(result.deltaMinutes).toBeLessThan(8);
  });

  it("returns behind when > 8 min behind", () => {
    const group = createGroupState("g-1", 1);
    group.state = "PLAYING";
    group.currentHole = 3;
    group.paceStartTime = BASE_TIME;

    // Expected at hole 3 = 45 min. If 55 min elapsed → delta = +10 → behind
    const now = minutesAfter(BASE_TIME, 55);
    const result = calculatePaceStatus(group, holes, now);

    expect(result.status).toBe("behind");
    expect(result.deltaMinutes).toBeGreaterThan(8);
  });

  // ── Hysteresis tests ──────────────────────────────────────────────

  it("maintains behind status until delta drops below 6 (hysteresis)", () => {
    const group = createGroupState("g-1", 1);
    group.state = "PLAYING";
    group.currentHole = 3;
    group.paceStartTime = BASE_TIME;
    group.paceStatus = "behind"; // Already behind

    // delta = +7 → still above exit threshold of 6 → stays behind
    const now = minutesAfter(BASE_TIME, 52);
    const result = calculatePaceStatus(group, holes, now);

    expect(result.status).toBe("behind");
  });

  it("downgrades behind to attention when delta drops below 6", () => {
    const group = createGroupState("g-1", 1);
    group.state = "PLAYING";
    group.currentHole = 3;
    group.paceStartTime = BASE_TIME;
    group.paceStatus = "behind";

    // delta = +5 → below exit threshold of 6 but above attention_exit 2 → attention
    const now = minutesAfter(BASE_TIME, 50);
    const result = calculatePaceStatus(group, holes, now);

    expect(result.status).toBe("attention");
  });

  it("maintains attention status until delta drops below 2 (hysteresis)", () => {
    const group = createGroupState("g-1", 1);
    group.state = "PLAYING";
    group.currentHole = 3;
    group.paceStartTime = BASE_TIME;
    group.paceStatus = "attention"; // Already attention

    // delta = +2.5 → still above exit threshold of 2 → stays attention
    const now = minutesAfter(BASE_TIME, 47.5);
    const result = calculatePaceStatus(group, holes, now);

    expect(result.status).toBe("attention");
  });

  // ── EWMA smoothing ────────────────────────────────────────────────

  it("smooths pace factor with EWMA", () => {
    const group = createGroupState("g-1", 1);
    group.state = "PLAYING";
    group.currentHole = 3;
    group.paceStartTime = BASE_TIME;
    group.paceFactor = 1.0; // Previous factor

    // Expected 45 min, elapsed 50 min → raw factor = 50/45 ≈ 1.11
    // EWMA: 0.3 * 1.11 + 0.7 * 1.0 ≈ 1.033
    const now = minutesAfter(BASE_TIME, 50);
    const result = calculatePaceStatus(group, holes, now);

    expect(result.paceFactor).toBeGreaterThan(1.0);
    expect(result.paceFactor).toBeLessThan(1.11); // Smoothed toward 1.0
  });

  it("clamps pace factor to [0.7, 1.5]", () => {
    const group = createGroupState("g-1", 1);
    group.state = "PLAYING";
    group.currentHole = 3;
    group.paceStartTime = BASE_TIME;
    group.paceFactor = 1.5; // Already at max

    // Very slow: 80 min for 45 min expected → raw = 1.78
    const now = minutesAfter(BASE_TIME, 80);
    const result = calculatePaceStatus(group, holes, now);

    expect(result.paceFactor).toBeLessThanOrEqual(1.5);
  });
});

// ── Projected finish ────────────────────────────────────────────────

describe("calculateProjectedFinish", () => {
  const holes = makeHoles();

  it("returns null for group on hole 1 (insufficient data)", () => {
    const group = createGroupState("g-1", 1);
    group.state = "PLAYING";
    group.paceStartTime = BASE_TIME;
    group.currentHole = 1;

    expect(calculateProjectedFinish(group, holes, BASE_TIME)).toBeNull();
  });

  it("returns projected finish for group mid-round", () => {
    const group = createGroupState("g-1", 1);
    group.state = "PLAYING";
    group.currentHole = 9;
    group.paceStartTime = BASE_TIME;
    group.paceFactor = 1.1; // 10% slower

    const now = minutesAfter(BASE_TIME, 140);
    const projected = calculateProjectedFinish(group, holes, now);

    expect(projected).not.toBeNull();
    expect(projected!.getTime()).toBeGreaterThan(now.getTime());
  });

  it("returns null for finished group", () => {
    const group = createGroupState("g-1", 1);
    group.state = "FINISHED";

    expect(calculateProjectedFinish(group, makeHoles(), BASE_TIME)).toBeNull();
  });
});

// ── updateGroupHole ─────────────────────────────────────────────────

describe("updateGroupHole", () => {
  it("records hole arrival and returns true on change", () => {
    const group = createGroupState("g-1", 1);
    group.state = "PLAYING";
    group.currentHole = 3;

    const now = new Date("2026-03-15T08:45:00Z");
    const changed = updateGroupHole(group, 4, now);

    expect(changed).toBe(true);
    expect(group.currentHole).toBe(4);
    expect(group.holeArrivals.get(4)).toEqual(now);
  });

  it("returns false when hole unchanged", () => {
    const group = createGroupState("g-1", 1);
    group.currentHole = 3;

    expect(updateGroupHole(group, 3, BASE_TIME)).toBe(false);
  });

  it("transitions FORMING → PLAYING when moving beyond hole 1", () => {
    const group = createGroupState("g-1", 1);
    group.state = "FORMING";
    group.holeArrivals.set(1, BASE_TIME);

    updateGroupHole(group, 2, minutesAfter(BASE_TIME, 15));

    expect(group.state).toBe("PLAYING");
    expect(group.paceStartTime).toEqual(BASE_TIME);
  });
});

// ── startPaceClock ──────────────────────────────────────────────────

describe("startPaceClock", () => {
  it("starts pace clock for FORMING group", () => {
    const group = createGroupState("g-1", 1);
    group.state = "FORMING";
    group.holeArrivals.set(1, BASE_TIME);

    startPaceClock(group, minutesAfter(BASE_TIME, 5));

    expect(group.state).toBe("PLAYING");
    expect(group.paceStartTime).toEqual(BASE_TIME); // Uses hole 1 arrival
  });

  it("does nothing for non-FORMING group", () => {
    const group = createGroupState("g-1", 1);
    group.state = "PLAYING";
    group.paceStartTime = BASE_TIME;

    startPaceClock(group, minutesAfter(BASE_TIME, 30));

    expect(group.paceStartTime).toEqual(BASE_TIME); // Unchanged
  });
});
