import { describe, it, expect, beforeEach } from "vitest";
import { useDashboardStore } from "../dashboard-store";
import type {
  DashboardGroupUpdate,
  DashboardAlertEvent,
  DashboardBottleneckEvent,
} from "@golfix/shared";

const makeGroup = (overrides: Partial<DashboardGroupUpdate> = {}): DashboardGroupUpdate => ({
  groupId: "g1",
  groupNumber: 1,
  currentHole: 5,
  paceStatus: "on_pace",
  paceFactor: 1.0,
  sessions: ["s1", "s2"],
  projectedFinish: null,
  centroid: { lat: 48.8, lng: 2.3 },
  ...overrides,
});

const makeAlert = (overrides: Partial<DashboardAlertEvent> = {}): DashboardAlertEvent => ({
  type: "behind_pace",
  severity: "warning",
  groupId: "g1",
  groupNumber: 1,
  currentHole: 5,
  details: {},
  timestamp: new Date().toISOString(),
  ...overrides,
});

const makeBottleneck = (
  overrides: Partial<DashboardBottleneckEvent> = {},
): DashboardBottleneckEvent => ({
  hole: 7,
  blockerGroupId: "g3",
  affectedGroupIds: ["g4", "g5"],
  rootHole: 7,
  isCascade: false,
  timestamp: new Date().toISOString(),
  ...overrides,
});

describe("dashboard-store", () => {
  beforeEach(() => {
    useDashboardStore.getState().reset();
  });

  it("starts with empty state", () => {
    const state = useDashboardStore.getState();
    expect(state.groups).toEqual([]);
    expect(state.alerts).toEqual([]);
    expect(state.bottlenecks).toEqual([]);
    expect(state.connected).toBe(false);
  });

  it("setGroups replaces all groups", () => {
    const groups = [makeGroup(), makeGroup({ groupId: "g2", groupNumber: 2 })];
    useDashboardStore.getState().setGroups(groups);
    expect(useDashboardStore.getState().groups).toHaveLength(2);
  });

  it("addAlert prepends alert and caps at 100", () => {
    const store = useDashboardStore.getState();

    for (let i = 0; i < 105; i++) {
      store.addAlert(makeAlert({ groupId: `g${i}` }));
    }

    const alerts = useDashboardStore.getState().alerts;
    expect(alerts).toHaveLength(100);
    expect(alerts[0]!.groupId).toBe("g104");
  });

  it("setBottlenecks replaces bottlenecks", () => {
    useDashboardStore.getState().setBottlenecks([makeBottleneck()]);
    expect(useDashboardStore.getState().bottlenecks).toHaveLength(1);
  });

  it("setConnected updates connection status", () => {
    useDashboardStore.getState().setConnected(true);
    expect(useDashboardStore.getState().connected).toBe(true);
  });

  it("reset clears all state", () => {
    useDashboardStore.getState().setGroups([makeGroup()]);
    useDashboardStore.getState().addAlert(makeAlert());
    useDashboardStore.getState().setConnected(true);

    useDashboardStore.getState().reset();

    const state = useDashboardStore.getState();
    expect(state.groups).toEqual([]);
    expect(state.alerts).toEqual([]);
    expect(state.connected).toBe(false);
  });
});
