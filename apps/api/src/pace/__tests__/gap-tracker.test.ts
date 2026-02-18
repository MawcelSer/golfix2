import { describe, it, expect } from "vitest";
import { calculateGaps } from "../gap-tracker";
import { createGroupState, type GroupState } from "../pace-types";

// ── Helpers ─────────────────────────────────────────────────────────

function minutesAfter(base: Date, minutes: number): Date {
  return new Date(base.getTime() + minutes * 60000);
}

const BASE_TIME = new Date("2026-03-15T08:00:00Z");

function makePlayingGroup(
  id: string,
  groupNumber: number,
  currentHole: number,
  arrivals: [number, Date][],
): GroupState {
  const group = createGroupState(id, groupNumber);
  group.state = "PLAYING";
  group.currentHole = currentHole;
  group.paceStartTime = arrivals[0]?.[1] ?? BASE_TIME;
  for (const [hole, time] of arrivals) {
    group.holeArrivals.set(hole, time);
  }
  return group;
}

// ── Tests ───────────────────────────────────────────────────────────

describe("calculateGaps", () => {
  it("returns empty for < 2 active groups", () => {
    const groups = new Map<string, GroupState>();
    groups.set("g-1", makePlayingGroup("g-1", 1, 5, [[5, BASE_TIME]]));

    expect(calculateGaps(groups)).toEqual([]);
  });

  it("calculates normal gap between two groups", () => {
    const groups = new Map<string, GroupState>();

    // Group 1 arrived at hole 5 at 08:40, group 2 at 08:50 → 10 min gap
    groups.set(
      "g-1",
      makePlayingGroup("g-1", 1, 7, [
        [1, BASE_TIME],
        [5, minutesAfter(BASE_TIME, 40)],
        [7, minutesAfter(BASE_TIME, 70)],
      ]),
    );
    groups.set(
      "g-2",
      makePlayingGroup("g-2", 2, 5, [
        [1, minutesAfter(BASE_TIME, 10)],
        [5, minutesAfter(BASE_TIME, 50)],
      ]),
    );

    const gaps = calculateGaps(groups);
    expect(gaps).toHaveLength(1);

    const gap = gaps[0]!;
    expect(gap.groupAheadId).toBe("g-1");
    expect(gap.groupBehindId).toBe("g-2");
    expect(gap.gapMinutes).toBe(10);
    expect(gap.severity).toBe("normal");
    expect(gap.measuredAtHole).toBe(5);
  });

  it("detects compression (gap < 5 min)", () => {
    const groups = new Map<string, GroupState>();

    groups.set(
      "g-1",
      makePlayingGroup("g-1", 1, 6, [
        [1, BASE_TIME],
        [5, minutesAfter(BASE_TIME, 40)],
      ]),
    );
    groups.set(
      "g-2",
      makePlayingGroup("g-2", 2, 5, [
        [1, minutesAfter(BASE_TIME, 8)],
        [5, minutesAfter(BASE_TIME, 44)], // 4 min gap at hole 5
      ]),
    );

    const gaps = calculateGaps(groups);
    expect(gaps[0]!.severity).toBe("compression");
    expect(gaps[0]!.gapMinutes).toBe(4);
  });

  it("detects severe compression (gap < 2 min)", () => {
    const groups = new Map<string, GroupState>();

    groups.set(
      "g-1",
      makePlayingGroup("g-1", 1, 6, [
        [1, BASE_TIME],
        [5, minutesAfter(BASE_TIME, 40)],
      ]),
    );
    groups.set(
      "g-2",
      makePlayingGroup("g-2", 2, 5, [
        [1, minutesAfter(BASE_TIME, 8)],
        [5, minutesAfter(BASE_TIME, 41)], // 1 min gap
      ]),
    );

    const gaps = calculateGaps(groups);
    expect(gaps[0]!.severity).toBe("severe_compression");
    expect(gaps[0]!.gapMinutes).toBe(1);
  });

  it("detects lagging (gap > 15 min)", () => {
    const groups = new Map<string, GroupState>();

    groups.set(
      "g-1",
      makePlayingGroup("g-1", 1, 7, [
        [1, BASE_TIME],
        [5, minutesAfter(BASE_TIME, 40)],
      ]),
    );
    groups.set(
      "g-2",
      makePlayingGroup("g-2", 2, 5, [
        [1, minutesAfter(BASE_TIME, 8)],
        [5, minutesAfter(BASE_TIME, 60)], // 20 min gap
      ]),
    );

    const gaps = calculateGaps(groups);
    expect(gaps[0]!.severity).toBe("lagging");
  });

  it("determines closing direction when gap is shrinking", () => {
    const groups = new Map<string, GroupState>();

    // Hole 4: 10 min gap. Hole 5: 7 min gap. → closing
    groups.set(
      "g-1",
      makePlayingGroup("g-1", 1, 7, [
        [1, BASE_TIME],
        [4, minutesAfter(BASE_TIME, 30)],
        [5, minutesAfter(BASE_TIME, 45)],
      ]),
    );
    groups.set(
      "g-2",
      makePlayingGroup("g-2", 2, 5, [
        [1, minutesAfter(BASE_TIME, 8)],
        [4, minutesAfter(BASE_TIME, 40)], // gap at 4: 10 min
        [5, minutesAfter(BASE_TIME, 52)], // gap at 5: 7 min → shrunk by 3 min
      ]),
    );

    const gaps = calculateGaps(groups);
    expect(gaps[0]!.direction).toBe("closing");
  });

  it("determines widening direction when gap is growing", () => {
    const groups = new Map<string, GroupState>();

    // Hole 4: 10 min gap. Hole 5: 14 min gap. → widening
    groups.set(
      "g-1",
      makePlayingGroup("g-1", 1, 7, [
        [1, BASE_TIME],
        [4, minutesAfter(BASE_TIME, 30)],
        [5, minutesAfter(BASE_TIME, 45)],
      ]),
    );
    groups.set(
      "g-2",
      makePlayingGroup("g-2", 2, 5, [
        [1, minutesAfter(BASE_TIME, 8)],
        [4, minutesAfter(BASE_TIME, 40)], // gap at 4: 10 min
        [5, minutesAfter(BASE_TIME, 59)], // gap at 5: 14 min → grew by 4 min
      ]),
    );

    const gaps = calculateGaps(groups);
    expect(gaps[0]!.direction).toBe("widening");
  });

  it("handles multiple groups with consecutive gaps", () => {
    const groups = new Map<string, GroupState>();

    groups.set(
      "g-1",
      makePlayingGroup("g-1", 1, 8, [
        [1, BASE_TIME],
        [5, minutesAfter(BASE_TIME, 40)],
      ]),
    );
    groups.set(
      "g-2",
      makePlayingGroup("g-2", 2, 6, [
        [1, minutesAfter(BASE_TIME, 8)],
        [5, minutesAfter(BASE_TIME, 48)],
      ]),
    );
    groups.set(
      "g-3",
      makePlayingGroup("g-3", 3, 5, [
        [1, minutesAfter(BASE_TIME, 16)],
        [5, minutesAfter(BASE_TIME, 56)],
      ]),
    );

    const gaps = calculateGaps(groups);
    expect(gaps).toHaveLength(2);
    expect(gaps[0]!.groupAheadId).toBe("g-1");
    expect(gaps[0]!.groupBehindId).toBe("g-2");
    expect(gaps[1]!.groupAheadId).toBe("g-2");
    expect(gaps[1]!.groupBehindId).toBe("g-3");
  });

  it("excludes FINISHED and FORMING groups", () => {
    const groups = new Map<string, GroupState>();

    const finished = createGroupState("g-1", 1);
    finished.state = "FINISHED";
    groups.set("g-1", finished);

    const forming = createGroupState("g-2", 2);
    forming.state = "FORMING";
    groups.set("g-2", forming);

    groups.set(
      "g-3",
      makePlayingGroup("g-3", 3, 5, [
        [1, BASE_TIME],
        [5, minutesAfter(BASE_TIME, 40)],
      ]),
    );

    expect(calculateGaps(groups)).toEqual([]);
  });

  it("uses fallback when groups have no common hole at current position", () => {
    const groups = new Map<string, GroupState>();

    // Group 1 has arrivals at holes 1-5, Group 2 only at holes 1-3
    // Group 2 is on hole 3, but group 1 also has hole 3 data
    groups.set(
      "g-1",
      makePlayingGroup("g-1", 1, 5, [
        [1, BASE_TIME],
        [2, minutesAfter(BASE_TIME, 15)],
        [3, minutesAfter(BASE_TIME, 30)],
        [5, minutesAfter(BASE_TIME, 60)],
      ]),
    );
    groups.set(
      "g-2",
      makePlayingGroup("g-2", 2, 3, [
        [1, minutesAfter(BASE_TIME, 8)],
        [2, minutesAfter(BASE_TIME, 23)],
        [3, minutesAfter(BASE_TIME, 38)],
      ]),
    );

    const gaps = calculateGaps(groups);
    expect(gaps).toHaveLength(1);
    expect(gaps[0]!.measuredAtHole).toBe(3); // Reference hole is groupBehind's current hole
    expect(gaps[0]!.gapMinutes).toBe(8);
  });
});
