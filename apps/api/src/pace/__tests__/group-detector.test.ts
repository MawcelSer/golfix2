import { describe, it, expect } from "vitest";
import {
  detectGroups,
  haversineDistance,
  reevaluateGroupMembership,
  type DetectionContext,
  type TeeTimeInfo,
  type SessionInfo,
} from "../group-detector";
import { createGroupState } from "../pace-types";

// ── Helpers ─────────────────────────────────────────────────────────

const BASE_TIME = new Date("2026-03-15T08:00:00Z");

function makeSession(id: string, startedAt: Date, lat = 44.838, lng = -0.579): SessionInfo {
  return {
    sessionId: id,
    startedAt,
    position: { sessionId: id, lat, lng, recordedAt: startedAt },
  };
}

function makeTeeTime(id: string, scheduledAt: Date, playersCount = 4): TeeTimeInfo {
  return { id, scheduledAt, playersCount };
}

function makeContext(overrides: Partial<DetectionContext> = {}): DetectionContext {
  return {
    teeTimes: [],
    unassignedSessions: [],
    groups: new Map(),
    now: BASE_TIME,
    ...overrides,
  };
}

// ── Tests ───────────────────────────────────────────────────────────

describe("haversineDistance", () => {
  it("calculates distance between two GPS points", () => {
    // ~111km between 0° and 1° latitude
    const dist = haversineDistance(0, 0, 1, 0);
    expect(dist).toBeGreaterThan(110000);
    expect(dist).toBeLessThan(112000);
  });

  it("returns 0 for same point", () => {
    const dist = haversineDistance(44.838, -0.579, 44.838, -0.579);
    expect(dist).toBe(0);
  });
});

describe("detectGroups", () => {
  // ── Tee time matching ─────────────────────────────────────────────

  describe("tee time matching", () => {
    it("assigns session to group when within ±10 min of tee time", () => {
      const teeTime = makeTeeTime("tt-1", new Date("2026-03-15T08:00:00Z"));
      const session = makeSession("s-1", new Date("2026-03-15T08:05:00Z")); // 5 min late

      const ctx = makeContext({
        teeTimes: [teeTime],
        unassignedSessions: [session],
      });

      const groups = detectGroups(ctx);
      expect(groups.size).toBe(1);

      const group = [...groups.values()][0]!;
      expect(group.teeTimeId).toBe("tt-1");
      expect(group.sessions).toContain("s-1");
    });

    it("rejects session if > 10 min from any tee time", () => {
      const teeTime = makeTeeTime("tt-1", new Date("2026-03-15T08:00:00Z"));
      const session = makeSession("s-1", new Date("2026-03-15T08:15:00Z")); // 15 min late

      const ctx = makeContext({
        teeTimes: [teeTime],
        unassignedSessions: [session],
      });

      const groups = detectGroups(ctx);
      expect(groups.size).toBe(1);

      // Created as solo group (no tee time)
      const group = [...groups.values()][0]!;
      expect(group.teeTimeId).toBeNull();
    });

    it("adds multiple sessions to same tee time group", () => {
      const teeTime = makeTeeTime("tt-1", new Date("2026-03-15T08:00:00Z"));
      const s1 = makeSession("s-1", new Date("2026-03-15T08:00:00Z"));
      const s2 = makeSession("s-2", new Date("2026-03-15T08:01:00Z"));

      const ctx = makeContext({
        teeTimes: [teeTime],
        unassignedSessions: [s1],
      });

      detectGroups(ctx);

      // Now add second session
      ctx.unassignedSessions = [s2];
      const groups = detectGroups(ctx);

      expect(groups.size).toBe(1);
      const group = [...groups.values()][0]!;
      expect(group.sessions).toHaveLength(2);
      expect(group.sessions).toContain("s-1");
      expect(group.sessions).toContain("s-2");
    });

    it("does not exceed MAX_GROUP_SIZE (4) for tee time group", () => {
      const teeTime = makeTeeTime("tt-1", new Date("2026-03-15T08:00:00Z"));
      const sessions = Array.from({ length: 5 }, (_, i) =>
        makeSession(`s-${i}`, new Date("2026-03-15T08:00:00Z")),
      );

      const ctx = makeContext({
        teeTimes: [teeTime],
        unassignedSessions: sessions,
      });

      const groups = detectGroups(ctx);

      // First 4 in tee time group, 5th in solo group
      expect(groups.size).toBe(2);
      const groupArr = [...groups.values()];
      const teeTimeGroup = groupArr.find((g) => g.teeTimeId === "tt-1")!;
      expect(teeTimeGroup.sessions).toHaveLength(4);
    });
  });

  // ── GPS co-location clustering ────────────────────────────────────

  describe("GPS co-location clustering", () => {
    it("groups sessions starting within 3 min on Hole 1", () => {
      const s1 = makeSession("s-1", new Date("2026-03-15T08:00:00Z"));
      const s2 = makeSession("s-2", new Date("2026-03-15T08:02:00Z")); // 2 min apart

      const ctx = makeContext({ unassignedSessions: [s1] });
      detectGroups(ctx);

      ctx.unassignedSessions = [s2];
      const groups = detectGroups(ctx);

      expect(groups.size).toBe(1);
      const group = [...groups.values()][0]!;
      expect(group.sessions).toHaveLength(2);
    });

    it("creates separate groups for sessions > 3 min apart", () => {
      const s1 = makeSession("s-1", new Date("2026-03-15T08:00:00Z"));
      const s2 = makeSession("s-2", new Date("2026-03-15T08:05:00Z")); // 5 min apart

      const ctx = makeContext({
        unassignedSessions: [s1],
        now: new Date("2026-03-15T08:00:00Z"),
      });
      detectGroups(ctx);

      ctx.unassignedSessions = [s2];
      ctx.now = new Date("2026-03-15T08:05:00Z");
      const groups = detectGroups(ctx);

      expect(groups.size).toBe(2);
    });
  });

  // ── Solo players ──────────────────────────────────────────────────

  describe("solo players", () => {
    it("creates solo group when no match", () => {
      const session = makeSession("s-1", BASE_TIME);
      const ctx = makeContext({ unassignedSessions: [session] });

      const groups = detectGroups(ctx);
      expect(groups.size).toBe(1);

      const group = [...groups.values()][0]!;
      expect(group.sessions).toEqual(["s-1"]);
      expect(group.teeTimeId).toBeNull();
    });
  });

  // ── Group numbering ───────────────────────────────────────────────

  describe("group numbering", () => {
    it("assigns sequential group numbers", () => {
      const s1 = makeSession("s-1", new Date("2026-03-15T08:00:00Z"));
      const s2 = makeSession("s-2", new Date("2026-03-15T08:30:00Z"));

      const ctx = makeContext({ unassignedSessions: [s1] });
      detectGroups(ctx);

      ctx.unassignedSessions = [s2];
      ctx.now = new Date("2026-03-15T08:30:00Z");
      const groups = detectGroups(ctx);

      const groupArr = [...groups.values()].sort((a, b) => a.groupNumber - b.groupNumber);
      expect(groupArr[0]!.groupNumber).toBe(1);
      expect(groupArr[1]!.groupNumber).toBe(2);
    });
  });
});

// ── Membership re-evaluation ────────────────────────────────────────

describe("reevaluateGroupMembership", () => {
  it("flags lost contact after 10 min without GPS", () => {
    const group = createGroupState("g-1", 1);
    group.sessions = ["s-1", "s-2"];
    group.state = "PLAYING";

    const now = new Date("2026-03-15T09:00:00Z");
    const result = reevaluateGroupMembership(
      group,
      [
        {
          sessionId: "s-1",
          lastPosition: {
            sessionId: "s-1",
            lat: 44.838,
            lng: -0.579,
            recordedAt: new Date("2026-03-15T08:48:00Z"), // 12 min ago
          },
          currentHole: 5,
        },
        {
          sessionId: "s-2",
          lastPosition: {
            sessionId: "s-2",
            lat: 44.838,
            lng: -0.579,
            recordedAt: new Date("2026-03-15T08:59:00Z"), // 1 min ago
          },
          currentHole: 5,
        },
      ],
      now,
    );

    expect(result.lostContact).toContain("s-1");
    expect(result.abandoned).toHaveLength(0);
    expect(group.sessions).toHaveLength(2); // Not removed yet
  });

  it("marks abandoned after 20 min without GPS and removes from group", () => {
    const group = createGroupState("g-1", 1);
    group.sessions = ["s-1", "s-2"];
    group.state = "PLAYING";

    const now = new Date("2026-03-15T09:00:00Z");
    const result = reevaluateGroupMembership(
      group,
      [
        {
          sessionId: "s-1",
          lastPosition: {
            sessionId: "s-1",
            lat: 44.838,
            lng: -0.579,
            recordedAt: new Date("2026-03-15T08:38:00Z"), // 22 min ago
          },
          currentHole: 5,
        },
        {
          sessionId: "s-2",
          lastPosition: {
            sessionId: "s-2",
            lat: 44.838,
            lng: -0.579,
            recordedAt: new Date("2026-03-15T08:59:00Z"),
          },
          currentHole: 5,
        },
      ],
      now,
    );

    expect(result.abandoned).toContain("s-1");
    expect(group.sessions).toEqual(["s-2"]); // s-1 removed
  });

  it("finishes group when all sessions abandoned", () => {
    const group = createGroupState("g-1", 1);
    group.sessions = ["s-1"];
    group.state = "PLAYING";

    const now = new Date("2026-03-15T09:00:00Z");
    reevaluateGroupMembership(
      group,
      [
        {
          sessionId: "s-1",
          lastPosition: {
            sessionId: "s-1",
            lat: 44.838,
            lng: -0.579,
            recordedAt: new Date("2026-03-15T08:38:00Z"), // 22 min ago
          },
          currentHole: 5,
        },
      ],
      now,
    );

    expect(group.sessions).toHaveLength(0);
    expect(group.state).toBe("FINISHED");
  });

  it("flags separated player > 2 holes behind median", () => {
    const group = createGroupState("g-1", 1);
    group.sessions = ["s-1", "s-2", "s-3"];
    group.state = "PLAYING";
    group.currentHole = 8;

    const now = new Date("2026-03-15T09:00:00Z");
    const result = reevaluateGroupMembership(
      group,
      [
        {
          sessionId: "s-1",
          lastPosition: {
            sessionId: "s-1",
            lat: 44.838,
            lng: -0.579,
            recordedAt: now,
          },
          currentHole: 5, // 3 holes behind median of 8
        },
        {
          sessionId: "s-2",
          lastPosition: {
            sessionId: "s-2",
            lat: 44.838,
            lng: -0.579,
            recordedAt: now,
          },
          currentHole: 8,
        },
        {
          sessionId: "s-3",
          lastPosition: {
            sessionId: "s-3",
            lat: 44.838,
            lng: -0.579,
            recordedAt: now,
          },
          currentHole: 8,
        },
      ],
      now,
    );

    expect(result.separated).toContain("s-1");
  });
});
