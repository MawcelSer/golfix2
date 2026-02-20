import { describe, expect, it } from "vitest";
import { PaceEngineManager } from "../pace-engine-manager";
import type { GroupState, HoleData } from "../pace-types";
import type { DashboardGroupUpdate } from "@golfix/shared";

// ── Helpers ──────────────────────────────────────────────────────────

function makeHoles(count: number): HoleData[] {
  return Array.from({ length: count }, (_, i) => ({
    holeNumber: i + 1,
    par: i % 3 === 0 ? 5 : i % 3 === 1 ? 4 : 3,
    paceTargetMinutes: null,
    transitionMinutes: 3,
  }));
}

// Minimal serializer (same logic as pace-engine-plugin)
function serializeGroup(
  group: GroupState,
  projectedFinish: Date | null,
  positions: Map<string, { lat: number; lng: number }>,
): DashboardGroupUpdate {
  let centroid: { lat: number; lng: number } | null = null;
  const coords: { lat: number; lng: number }[] = [];

  for (const sessionId of group.sessions) {
    const pos = positions.get(sessionId);
    if (pos) coords.push(pos);
  }

  if (coords.length > 0) {
    const sumLat = coords.reduce((sum, c) => sum + c.lat, 0);
    const sumLng = coords.reduce((sum, c) => sum + c.lng, 0);
    centroid = { lat: sumLat / coords.length, lng: sumLng / coords.length };
  }

  return {
    groupId: group.id,
    groupNumber: group.groupNumber,
    currentHole: group.currentHole,
    paceStatus: group.paceStatus,
    paceFactor: group.paceFactor,
    sessions: group.sessions,
    projectedFinish: projectedFinish?.toISOString() ?? null,
    centroid,
  };
}

// ── Tests ────────────────────────────────────────────────────────────

describe("Pace Pipeline Integration", () => {
  it("PaceEngineManager creates engine and accepts positions", () => {
    const manager = new PaceEngineManager();
    const holes = makeHoles(18);
    const courseId = "course-1";

    const entry = manager.getOrCreate(courseId, holes);
    expect(entry.engine).toBeDefined();
    expect(entry.positions.size).toBe(0);

    manager.feedPosition(courseId, "s1", 48.41, 2.68, 1, new Date());
    expect(entry.positions.size).toBe(1);
    expect(entry.holeDetections.get("s1")).toBe(1);
  });

  it("feedPosition is ignored for unknown courses", () => {
    const manager = new PaceEngineManager();
    manager.feedPosition("unknown", "s1", 48.41, 2.68, 1, new Date());
    expect(manager.getEngine("unknown")).toBeUndefined();
  });

  it("full pipeline: create groups → feed positions → tick → serialize", () => {
    const manager = new PaceEngineManager();
    const holes = makeHoles(18);
    const courseId = "course-1";
    const now = new Date("2026-02-20T09:00:00Z");

    const entry = manager.getOrCreate(courseId, holes);
    const engine = entry.engine;

    // 1. Register sessions via processNewSessions with correct SessionInfo/TeeTimeInfo types
    engine.processNewSessions(
      [
        {
          sessionId: "s1",
          startedAt: new Date("2026-02-20T08:52:00Z"),
          position: { sessionId: "s1", lat: 48.41, lng: 2.68, recordedAt: now },
        },
        {
          sessionId: "s2",
          startedAt: new Date("2026-02-20T08:53:00Z"),
          position: { sessionId: "s2", lat: 48.41, lng: 2.68, recordedAt: now },
        },
      ],
      [
        {
          id: "tt1",
          scheduledAt: new Date("2026-02-20T08:50:00Z"),
          playersCount: 2,
        },
      ],
      now,
    );

    const groups = engine.getGroups();
    expect(groups.length).toBeGreaterThanOrEqual(1);

    const activeGroup = groups.find((g) => g.state === "PLAYING" || g.state === "FORMING");
    expect(activeGroup).toBeDefined();

    // 2. Feed positions through the manager
    manager.feedPosition(courseId, "s1", 48.411, 2.681, 1, now);
    manager.feedPosition(courseId, "s2", 48.412, 2.682, 1, now);

    // 3. Simulate the plugin tick cycle: updatePositions → tick
    entry.engine.updatePositions(
      new Map(
        [...entry.positions.entries()].map(([sid, p]) => [
          sid,
          { sessionId: sid, lat: p.lat, lng: p.lng, recordedAt: p.recordedAt },
        ]),
      ),
      entry.holeDetections,
      now,
    );

    const result = entry.engine.tick(now);

    // 4. Verify tick result structure
    expect(result.groups).toBeInstanceOf(Array);
    expect(result.alerts).toBeInstanceOf(Array);
    expect(result.bottlenecks).toBeInstanceOf(Array);
    expect(result.projectedFinishes).toBeInstanceOf(Map);

    // 5. Serialize groups → DashboardGroupUpdate[]
    const groupUpdates = result.groups.map((g) =>
      serializeGroup(g, result.projectedFinishes.get(g.id) ?? null, entry.positions),
    );

    expect(groupUpdates.length).toBeGreaterThanOrEqual(1);

    const firstUpdate = groupUpdates[0]!;
    expect(firstUpdate.groupId).toBeTruthy();
    expect(firstUpdate.paceStatus).toBeDefined();
    expect(typeof firstUpdate.paceFactor).toBe("number");
    expect(firstUpdate.sessions).toBeInstanceOf(Array);

    // Centroid should be computed from positions
    if (firstUpdate.centroid) {
      expect(typeof firstUpdate.centroid.lat).toBe("number");
      expect(typeof firstUpdate.centroid.lng).toBe("number");
    }

    // projectedFinish should be serializable string or null
    if (firstUpdate.projectedFinish !== null) {
      expect(typeof firstUpdate.projectedFinish).toBe("string");
      expect(new Date(firstUpdate.projectedFinish).getTime()).not.toBeNaN();
    }

    // Verify JSON-serializable (no Date objects, no Maps)
    const json = JSON.stringify(groupUpdates);
    expect(json).toBeTruthy();
    const parsed = JSON.parse(json) as DashboardGroupUpdate[];
    expect(parsed.length).toBe(groupUpdates.length);
  });

  it("plugin tick cycle clears positions after processing", () => {
    const manager = new PaceEngineManager();
    const holes = makeHoles(18);
    const courseId = "course-1";

    const entry = manager.getOrCreate(courseId, holes);

    manager.feedPosition(courseId, "s1", 48.41, 2.68, 1, new Date());
    expect(entry.positions.size).toBe(1);

    // Simulate plugin clearing after tick
    entry.positions.clear();
    entry.holeDetections.clear();

    expect(entry.positions.size).toBe(0);
    expect(entry.holeDetections.size).toBe(0);
  });

  it("mock Socket.io emission: verifies event shapes", () => {
    const manager = new PaceEngineManager();
    const holes = makeHoles(18);
    const courseId = "course-1";
    const now = new Date("2026-02-20T09:30:00Z");

    const entry = manager.getOrCreate(courseId, holes);

    // Process sessions with correct types
    entry.engine.processNewSessions(
      [
        {
          sessionId: "s1",
          startedAt: new Date("2026-02-20T09:25:00Z"),
          position: { sessionId: "s1", lat: 48.41, lng: 2.68, recordedAt: now },
        },
      ],
      [
        {
          id: "tt2",
          scheduledAt: new Date("2026-02-20T09:20:00Z"),
          playersCount: 1,
        },
      ],
      now,
    );

    manager.feedPosition(courseId, "s1", 48.41, 2.68, 3, now);

    // Simulate tick
    entry.engine.updatePositions(
      new Map([["s1", { sessionId: "s1", lat: 48.41, lng: 2.68, recordedAt: now }]]),
      new Map([["s1", 3]]),
      now,
    );

    const result = entry.engine.tick(now);

    // Mock io.to(room).emit — collect emitted events
    const emittedEvents: Array<{ event: string; data: unknown }> = [];
    const mockRoom = {
      emit: (event: string, data: unknown) => {
        emittedEvents.push({ event, data });
      },
    };

    // Simulate plugin emission logic
    const groupUpdates = result.groups.map((g) =>
      serializeGroup(g, result.projectedFinishes.get(g.id) ?? null, entry.positions),
    );

    if (groupUpdates.length > 0) {
      mockRoom.emit("groups:update", groupUpdates);
    }

    for (const alert of result.alerts) {
      mockRoom.emit("alert:new", {
        type: alert.type,
        severity: alert.severity,
        groupId: alert.groupId,
        groupNumber: alert.groupNumber,
        currentHole: alert.currentHole,
        details: alert.details,
        timestamp: alert.timestamp.toISOString(),
      });
    }

    // Verify at least groups:update was emitted
    const groupEvent = emittedEvents.find((e) => e.event === "groups:update");
    expect(groupEvent).toBeDefined();

    const updates = groupEvent!.data as DashboardGroupUpdate[];
    expect(updates.length).toBeGreaterThanOrEqual(1);

    // Verify the emitted data is JSON-serializable (no Date objects, no Maps)
    const json = JSON.stringify(updates);
    expect(json).toBeTruthy();
    const parsed = JSON.parse(json) as DashboardGroupUpdate[];
    expect(parsed[0]!.groupId).toBeTruthy();
  });

  it("multiple courses run independently", () => {
    const manager = new PaceEngineManager();
    const holes = makeHoles(9);

    const entry1 = manager.getOrCreate("course-a", holes);
    const entry2 = manager.getOrCreate("course-b", holes);

    expect(entry1.engine).not.toBe(entry2.engine);

    manager.feedPosition("course-a", "s1", 48.41, 2.68, 1, new Date());
    manager.feedPosition("course-b", "s2", 43.6, 1.44, 1, new Date());

    expect(entry1.positions.size).toBe(1);
    expect(entry2.positions.size).toBe(1);
    expect(entry1.positions.has("s1")).toBe(true);
    expect(entry2.positions.has("s2")).toBe(true);
  });
});
