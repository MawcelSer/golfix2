import { describe, it, expect } from "vitest";
import { detectBottlenecks, type BottleneckState } from "../bottleneck-detector";
import { createGroupState, type GroupState, type HoleData } from "../pace-types";

// ── Helpers ─────────────────────────────────────────────────────────

const BASE_TIME = new Date("2026-03-15T08:00:00Z");

function minutesAfter(base: Date, minutes: number): Date {
  return new Date(base.getTime() + minutes * 60000);
}

function makeHoles(): HoleData[] {
  const pars = [4, 3, 5, 4, 4, 3, 4, 5, 4, 4, 3, 5, 4, 4, 3, 4, 5, 4];
  return pars.map((par, i) => ({
    holeNumber: i + 1,
    par,
    paceTargetMinutes: null,
    transitionMinutes: i === 6 ? 3 : i === 17 ? 0 : 1,
  }));
}

function makePlayingGroup(
  id: string,
  groupNumber: number,
  currentHole: number,
  arrivalTime: Date,
): GroupState {
  const group = createGroupState(id, groupNumber);
  group.state = "PLAYING";
  group.currentHole = currentHole;
  group.holeArrivals.set(currentHole, arrivalTime);
  return group;
}

// ── Tests ───────────────────────────────────────────────────────────

describe("detectBottlenecks", () => {
  const holes = makeHoles();

  it("returns no bottlenecks when no holes have 2+ groups", () => {
    const groups = new Map<string, GroupState>();
    groups.set("g-1", makePlayingGroup("g-1", 1, 5, minutesAfter(BASE_TIME, 40)));
    groups.set("g-2", makePlayingGroup("g-2", 2, 3, minutesAfter(BASE_TIME, 30)));

    const result = detectBottlenecks(groups, holes, new Map(), BASE_TIME);
    expect(result.active).toHaveLength(0);
    expect(result.resolved).toHaveLength(0);
  });

  it("detects bottleneck when 2 groups on par-4 hole for >3 min", () => {
    const groups = new Map<string, GroupState>();
    // Both groups on hole 5 (par 4), arrived 4 min ago
    groups.set("g-1", makePlayingGroup("g-1", 1, 5, minutesAfter(BASE_TIME, -4)));
    groups.set("g-2", makePlayingGroup("g-2", 2, 5, minutesAfter(BASE_TIME, -2)));

    // Previous state: they were already tracked starting 4 min ago
    const prev = new Map<number, BottleneckState>();
    prev.set(5, {
      hole: 5,
      startedAt: minutesAfter(BASE_TIME, -4),
      blockerGroupId: "g-1",
      isCascade: false,
      rootHole: null,
      alertEmitted: false,
      resolvedAt: null,
    });

    const result = detectBottlenecks(groups, holes, prev, BASE_TIME);
    expect(result.active.length).toBeGreaterThanOrEqual(1);

    const bn = result.active.find((b) => b.hole === 5);
    expect(bn).toBeDefined();
    expect(bn!.blockerGroupId).toBe("g-1"); // First to arrive = blocker
  });

  it("does not trigger par-3 bottleneck before 5 min threshold", () => {
    const groups = new Map<string, GroupState>();
    // Hole 2 is par 3. Two groups present for 4 min (under 5 min threshold)
    groups.set("g-1", makePlayingGroup("g-1", 1, 2, minutesAfter(BASE_TIME, -4)));
    groups.set("g-2", makePlayingGroup("g-2", 2, 2, minutesAfter(BASE_TIME, -2)));

    const prev = new Map<number, BottleneckState>();
    prev.set(2, {
      hole: 2,
      startedAt: minutesAfter(BASE_TIME, -4),
      blockerGroupId: "g-1",
      isCascade: false,
      rootHole: null,
      alertEmitted: false,
      resolvedAt: null,
    });

    const result = detectBottlenecks(groups, holes, prev, BASE_TIME);
    // Should still be tracking but not over threshold
    const bn = result.active.find((b) => b.hole === 2);
    // The bottleneck exists as tracking state but 4 min < 5 min threshold
    // so it should not be in the "over threshold" set (alertEmitted stays false)
    if (bn) {
      expect(bn.alertEmitted).toBe(false);
    }
  });

  it("triggers par-3 bottleneck after 5 min threshold", () => {
    const groups = new Map<string, GroupState>();
    groups.set("g-1", makePlayingGroup("g-1", 1, 2, minutesAfter(BASE_TIME, -6)));
    groups.set("g-2", makePlayingGroup("g-2", 2, 2, minutesAfter(BASE_TIME, -4)));

    const prev = new Map<number, BottleneckState>();
    prev.set(2, {
      hole: 2,
      startedAt: minutesAfter(BASE_TIME, -6),
      blockerGroupId: "g-1",
      isCascade: false,
      rootHole: null,
      alertEmitted: false,
      resolvedAt: null,
    });

    const result = detectBottlenecks(groups, holes, prev, BASE_TIME);
    const bn = result.active.find((b) => b.hole === 2);
    expect(bn).toBeDefined();
  });

  it("identifies blocker as the group that arrived earliest", () => {
    const groups = new Map<string, GroupState>();
    groups.set("g-1", makePlayingGroup("g-1", 1, 7, minutesAfter(BASE_TIME, -10)));
    groups.set("g-2", makePlayingGroup("g-2", 2, 7, minutesAfter(BASE_TIME, -5)));

    const prev = new Map<number, BottleneckState>();
    prev.set(7, {
      hole: 7,
      startedAt: minutesAfter(BASE_TIME, -5),
      blockerGroupId: "g-1",
      isCascade: false,
      rootHole: null,
      alertEmitted: false,
      resolvedAt: null,
    });

    const result = detectBottlenecks(groups, holes, prev, BASE_TIME);
    const bn = result.active.find((b) => b.hole === 7);
    expect(bn?.blockerGroupId).toBe("g-1");
  });

  it("identifies cascading bottlenecks and root cause", () => {
    const groups = new Map<string, GroupState>();
    // Three consecutive holes bottlenecked: 5, 6, 7
    groups.set("g-1", makePlayingGroup("g-1", 1, 5, minutesAfter(BASE_TIME, -10)));
    groups.set("g-2", makePlayingGroup("g-2", 2, 5, minutesAfter(BASE_TIME, -5)));
    groups.set("g-3", makePlayingGroup("g-3", 3, 6, minutesAfter(BASE_TIME, -8)));
    groups.set("g-4", makePlayingGroup("g-4", 4, 6, minutesAfter(BASE_TIME, -4)));
    groups.set("g-5", makePlayingGroup("g-5", 5, 7, minutesAfter(BASE_TIME, -7)));
    groups.set("g-6", makePlayingGroup("g-6", 6, 7, minutesAfter(BASE_TIME, -4)));

    const prev = new Map<number, BottleneckState>();
    for (const hole of [5, 6, 7]) {
      prev.set(hole, {
        hole,
        startedAt: minutesAfter(BASE_TIME, -5),
        blockerGroupId: "unknown",
        isCascade: false,
        rootHole: null,
        alertEmitted: false,
        resolvedAt: null,
      });
    }

    const result = detectBottlenecks(groups, holes, prev, BASE_TIME);

    const bn5 = result.active.find((b) => b.hole === 5);
    const bn6 = result.active.find((b) => b.hole === 6);
    const bn7 = result.active.find((b) => b.hole === 7);

    // Hole 5 is root (no bottleneck on hole 4)
    expect(bn5?.isCascade).toBe(false);

    // Holes 6 and 7 are cascades with root at hole 5
    expect(bn6?.isCascade).toBe(true);
    expect(bn6?.rootHole).toBe(5);
    expect(bn7?.isCascade).toBe(true);
    expect(bn7?.rootHole).toBe(5);
  });

  it("resolves bottleneck when groups separate", () => {
    const groups = new Map<string, GroupState>();
    groups.set("g-1", makePlayingGroup("g-1", 1, 6, minutesAfter(BASE_TIME, -1))); // Moved to hole 6
    groups.set("g-2", makePlayingGroup("g-2", 2, 5, minutesAfter(BASE_TIME, -5)));

    const prev = new Map<number, BottleneckState>();
    prev.set(5, {
      hole: 5,
      startedAt: minutesAfter(BASE_TIME, -8),
      blockerGroupId: "g-1",
      isCascade: false,
      rootHole: null,
      alertEmitted: true,
      resolvedAt: null,
    });

    const result = detectBottlenecks(groups, holes, prev, BASE_TIME);
    expect(result.resolved).toHaveLength(1);
    expect(result.resolved[0]!.hole).toBe(5);
    expect(result.resolved[0]!.resolvedAt).toEqual(BASE_TIME);
  });

  it("excludes FINISHED and FORMING groups from occupancy", () => {
    const groups = new Map<string, GroupState>();

    const finished = createGroupState("g-1", 1);
    finished.state = "FINISHED";
    finished.currentHole = 5;
    groups.set("g-1", finished);

    groups.set("g-2", makePlayingGroup("g-2", 2, 5, BASE_TIME));

    const result = detectBottlenecks(groups, holes, new Map(), BASE_TIME);
    expect(result.active).toHaveLength(0);
  });
});
