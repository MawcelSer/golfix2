import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the shared package before any imports
vi.mock("@golfix/shared", () => ({
  SOCKET_EVENTS: {
    ROOM_JOIN: "room:join",
    ROOM_LEAVE: "room:leave",
    AUTH_REFRESH: "auth:refresh",
    POSITION_UPDATE: "position:update",
    AUTH_REFRESHED: "auth:refreshed",
    POSITION_BROADCAST: "position:broadcast",
    ERROR: "error",
    GROUPS_UPDATE: "groups:update",
    ALERT_NEW: "alert:new",
    BOTTLENECK_UPDATE: "bottleneck:update",
  },
}));

import { PaceEngineManager } from "../pace-engine-manager";
import type { HoleData } from "../pace-types";

const holes: HoleData[] = [
  { holeNumber: 1, par: 4, paceTargetMinutes: 14, transitionMinutes: 1 },
  { holeNumber: 2, par: 3, paceTargetMinutes: 10, transitionMinutes: 1 },
];

describe("PaceEngineManager + tick integration", () => {
  let manager: PaceEngineManager;

  beforeEach(() => {
    vi.useFakeTimers();
    manager = new PaceEngineManager();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("engine tick returns empty groups when no positions fed", () => {
    const entry = manager.getOrCreate("c1", holes);
    const result = entry.engine.tick(new Date());

    expect(result.groups).toEqual([]);
    expect(result.alerts).toEqual([]);
    expect(result.bottlenecks).toEqual([]);
  });

  it("positions are cleared after engine processes them", () => {
    const entry = manager.getOrCreate("c1", holes);

    manager.feedPosition("c1", "s1", 48.85, 2.35, 1, new Date());
    expect(entry.positions.size).toBe(1);

    // Simulate what plugin does after tick
    entry.engine.updatePositions(
      new Map([["s1", { sessionId: "s1", lat: 48.85, lng: 2.35, recordedAt: new Date() }]]),
      entry.holeDetections,
      new Date(),
    );
    entry.engine.tick(new Date());
    entry.positions.clear();
    entry.holeDetections.clear();

    expect(entry.positions.size).toBe(0);
    expect(entry.holeDetections.size).toBe(0);
  });

  it("multiple sessions are tracked per course", () => {
    manager.getOrCreate("c1", holes);

    manager.feedPosition("c1", "s1", 48.85, 2.35, 1, new Date());
    manager.feedPosition("c1", "s2", 48.86, 2.36, 2, new Date());

    const entry = manager.getEngine("c1")!;
    expect(entry.positions.size).toBe(2);
    expect(entry.holeDetections.get("s1")).toBe(1);
    expect(entry.holeDetections.get("s2")).toBe(2);
  });
});
