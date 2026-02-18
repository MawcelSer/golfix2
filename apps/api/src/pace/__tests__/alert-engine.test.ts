import { describe, it, expect } from "vitest";
import {
  evaluatePaceAlerts,
  evaluateGapAlerts,
  evaluateBottleneckAlerts,
  recordReminder,
  type AlertEngineContext,
} from "../alert-engine";
import { createGroupState, type GapInfo } from "../pace-types";
import type { BottleneckState } from "../bottleneck-detector";

// ── Helpers ─────────────────────────────────────────────────────────

const BASE_TIME = new Date("2026-03-15T08:00:00Z");

function minutesAfter(base: Date, minutes: number): Date {
  return new Date(base.getTime() + minutes * 60000);
}

function makeCtx(now: Date = BASE_TIME): AlertEngineContext {
  return { courseId: "course-1", now };
}

// ── Pace Alert Tests ────────────────────────────────────────────────

describe("evaluatePaceAlerts", () => {
  it("emits behind_pace warning on first detection", () => {
    const group = createGroupState("g-1", 1);
    group.state = "PLAYING";
    group.paceStatus = "behind";
    group.currentHole = 6;

    const alerts = evaluatePaceAlerts(group, 10, "attention", makeCtx());
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.type).toBe("behind_pace");
    expect(alerts[0]!.severity).toBe("warning");
    expect(alerts[0]!.details.escalationLevel).toBe(1);
  });

  it("respects cooldown — no duplicate within 15 min", () => {
    const group = createGroupState("g-1", 1);
    group.state = "PLAYING";
    group.paceStatus = "behind";
    group.currentHole = 6;
    group.alertState.lastAlertType = "behind_pace";
    group.alertState.lastAlertTime = BASE_TIME;
    group.alertState.escalationLevel = 1;

    // Only 5 min later
    const alerts = evaluatePaceAlerts(group, 10, "behind", makeCtx(minutesAfter(BASE_TIME, 5)));
    expect(alerts).toHaveLength(0);
  });

  it("emits escalated alert after cooldown expires", () => {
    const group = createGroupState("g-1", 1);
    group.state = "PLAYING";
    group.paceStatus = "behind";
    group.currentHole = 6;
    group.alertState.lastAlertType = "behind_pace";
    group.alertState.lastAlertTime = BASE_TIME;
    group.alertState.escalationLevel = 1;

    // 16 min later (past 15 min cooldown)
    const alerts = evaluatePaceAlerts(group, 12, "behind", makeCtx(minutesAfter(BASE_TIME, 16)));
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.severity).toBe("warning");
    expect(alerts[0]!.details.escalationLevel).toBe(2);
  });

  it("emits critical alert at escalation level 3", () => {
    const group = createGroupState("g-1", 1);
    group.state = "PLAYING";
    group.paceStatus = "behind";
    group.currentHole = 8;
    group.alertState.lastAlertType = "behind_pace";
    group.alertState.lastAlertTime = BASE_TIME;
    group.alertState.escalationLevel = 2; // Post-reminder

    // After 20 min cooldown (escalated)
    const alerts = evaluatePaceAlerts(group, 15, "behind", makeCtx(minutesAfter(BASE_TIME, 21)));
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.severity).toBe("critical");
    expect(alerts[0]!.details.escalationLevel).toBe(3);
  });

  it("emits recovery event when group improves from behind to on_pace", () => {
    const group = createGroupState("g-1", 1);
    group.state = "PLAYING";
    group.paceStatus = "on_pace";
    group.currentHole = 10;
    group.alertState.escalationLevel = 1;

    const alerts = evaluatePaceAlerts(group, 0, "behind", makeCtx());
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.type).toBe("behind_pace");
    expect(alerts[0]!.severity).toBe("info");
    expect(alerts[0]!.details.resolved).toBe(true);

    // Alert state cleared
    expect(group.alertState.escalationLevel).toBe(0);
  });

  it("does not emit for on_pace group", () => {
    const group = createGroupState("g-1", 1);
    group.state = "PLAYING";
    group.paceStatus = "on_pace";
    group.currentHole = 5;

    const alerts = evaluatePaceAlerts(group, 0, "on_pace", makeCtx());
    expect(alerts).toHaveLength(0);
  });
});

// ── Gap Alert Tests ─────────────────────────────────────────────────

describe("evaluateGapAlerts", () => {
  it("emits gap_compression warning for gap < 5 min", () => {
    const group = createGroupState("g-2", 2);
    group.state = "PLAYING";
    group.currentHole = 5;

    const gap: GapInfo = {
      groupAheadId: "g-1",
      groupBehindId: "g-2",
      gapMinutes: 4,
      severity: "compression",
      direction: "closing",
      measuredAtHole: 5,
    };

    const alerts = evaluateGapAlerts(gap, group, makeCtx());
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.type).toBe("gap_compression");
    expect(alerts[0]!.severity).toBe("warning");
  });

  it("emits gap_severe critical for gap < 2 min", () => {
    const group = createGroupState("g-2", 2);
    group.state = "PLAYING";
    group.currentHole = 5;

    const gap: GapInfo = {
      groupAheadId: "g-1",
      groupBehindId: "g-2",
      gapMinutes: 1,
      severity: "severe_compression",
      direction: "closing",
      measuredAtHole: 5,
    };

    const alerts = evaluateGapAlerts(gap, group, makeCtx());
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.type).toBe("gap_severe");
    expect(alerts[0]!.severity).toBe("critical");
  });

  it("respects gap cooldown", () => {
    const group = createGroupState("g-2", 2);
    group.state = "PLAYING";
    group.currentHole = 5;
    group.alertState.lastAlertType = "gap_compression";
    group.alertState.lastAlertTime = BASE_TIME;

    const gap: GapInfo = {
      groupAheadId: "g-1",
      groupBehindId: "g-2",
      gapMinutes: 4,
      severity: "compression",
      direction: "closing",
      measuredAtHole: 5,
    };

    // 5 min later (within 10 min cooldown)
    const alerts = evaluateGapAlerts(gap, group, makeCtx(minutesAfter(BASE_TIME, 5)));
    expect(alerts).toHaveLength(0);
  });

  it("does not emit for normal gap", () => {
    const group = createGroupState("g-2", 2);
    group.state = "PLAYING";
    group.currentHole = 5;

    const gap: GapInfo = {
      groupAheadId: "g-1",
      groupBehindId: "g-2",
      gapMinutes: 10,
      severity: "normal",
      direction: "stable",
      measuredAtHole: 5,
    };

    const alerts = evaluateGapAlerts(gap, group, makeCtx());
    expect(alerts).toHaveLength(0);
  });
});

// ── Bottleneck Alert Tests ──────────────────────────────────────────

describe("evaluateBottleneckAlerts", () => {
  it("emits bottleneck warning for root bottleneck", () => {
    const groups = new Map();
    const blocker = createGroupState("g-1", 1);
    blocker.state = "PLAYING";
    blocker.currentHole = 5;
    groups.set("g-1", blocker);

    const bn: BottleneckState = {
      hole: 5,
      startedAt: minutesAfter(BASE_TIME, -5),
      blockerGroupId: "g-1",
      isCascade: false,
      rootHole: null,
      alertEmitted: false,
      resolvedAt: null,
    };

    const alerts = evaluateBottleneckAlerts(bn, groups, makeCtx());
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.type).toBe("bottleneck");
    expect(alerts[0]!.severity).toBe("warning");
    expect(bn.alertEmitted).toBe(true);
  });

  it("emits info severity for cascade bottleneck", () => {
    const groups = new Map();
    const blocker = createGroupState("g-3", 3);
    blocker.state = "PLAYING";
    blocker.currentHole = 7;
    groups.set("g-3", blocker);

    const bn: BottleneckState = {
      hole: 7,
      startedAt: minutesAfter(BASE_TIME, -4),
      blockerGroupId: "g-3",
      isCascade: true,
      rootHole: 5,
      alertEmitted: false,
      resolvedAt: null,
    };

    const alerts = evaluateBottleneckAlerts(bn, groups, makeCtx());
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.severity).toBe("info");
    expect(alerts[0]!.details.isCascade).toBe(true);
    expect(alerts[0]!.details.rootHole).toBe(5);
  });

  it("does not re-emit after alertEmitted set", () => {
    const groups = new Map();
    const blocker = createGroupState("g-1", 1);
    blocker.state = "PLAYING";
    blocker.currentHole = 5;
    groups.set("g-1", blocker);

    const bn: BottleneckState = {
      hole: 5,
      startedAt: minutesAfter(BASE_TIME, -5),
      blockerGroupId: "g-1",
      isCascade: false,
      rootHole: null,
      alertEmitted: true,
      resolvedAt: null,
    };

    const alerts = evaluateBottleneckAlerts(bn, groups, makeCtx());
    expect(alerts).toHaveLength(0);
  });
});

// ── Reminder Tests ──────────────────────────────────────────────────

describe("recordReminder", () => {
  it("records reminder and sets escalation to level 2", () => {
    const group = createGroupState("g-1", 1);
    group.state = "PLAYING";
    group.currentHole = 8;
    group.alertState.escalationLevel = 1;

    const alert = recordReminder(group, makeCtx());

    expect(alert.type).toBe("reminder_sent");
    expect(alert.severity).toBe("info");
    expect(group.alertState.lastReminderTime).toEqual(BASE_TIME);
    expect(group.alertState.escalationLevel).toBe(2);
  });

  it("resets cooldown timer", () => {
    const group = createGroupState("g-1", 1);
    group.state = "PLAYING";
    group.currentHole = 8;
    group.alertState.lastAlertTime = minutesAfter(BASE_TIME, -10);

    recordReminder(group, makeCtx());

    expect(group.alertState.lastAlertTime).toEqual(BASE_TIME);
  });
});
