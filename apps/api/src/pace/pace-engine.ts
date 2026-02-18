import { type GroupState, type HoleData, type PaceAlert, type SessionPosition } from "./pace-types";
import {
  detectGroups,
  reevaluateGroupMembership,
  type DetectionContext,
  type SessionInfo,
  type TeeTimeInfo,
  type MemberStatus,
} from "./group-detector";
import { calculatePaceStatus, updateGroupHole, calculateProjectedFinish } from "./pace-calculator";
import { calculateGaps } from "./gap-tracker";
import { detectBottlenecks, type BottleneckState } from "./bottleneck-detector";
import { evaluatePaceAlerts, evaluateGapAlerts, evaluateBottleneckAlerts } from "./alert-engine";

// ── Types ───────────────────────────────────────────────────────────

export interface PaceEngineState {
  courseId: string;
  groups: Map<string, GroupState>;
  bottlenecks: Map<number, BottleneckState>;
  lastTick: Date | null;
}

export interface TickResult {
  groups: GroupState[];
  alerts: PaceAlert[];
  bottlenecks: BottleneckState[];
  projectedFinishes: Map<string, Date | null>;
}

export interface PaceEngineConfig {
  courseId: string;
  holes: HoleData[];
}

// ── Pace Engine ─────────────────────────────────────────────────────

export class PaceEngine {
  private state: PaceEngineState;
  private holes: HoleData[];

  constructor(config: PaceEngineConfig) {
    this.holes = config.holes.slice().sort((a, b) => a.holeNumber - b.holeNumber);
    this.state = {
      courseId: config.courseId,
      groups: new Map(),
      bottlenecks: new Map(),
      lastTick: null,
    };
  }

  /**
   * Process new sessions detected on Hole 1.
   */
  processNewSessions(sessions: SessionInfo[], teeTimes: TeeTimeInfo[], now: Date): void {
    const ctx: DetectionContext = {
      teeTimes,
      unassignedSessions: sessions,
      groups: this.state.groups,
      now,
    };
    detectGroups(ctx);
  }

  /**
   * Update member positions and detect hole transitions.
   */
  updatePositions(
    _positions: Map<string, SessionPosition>,
    holeDetections: Map<string, number | null>,
    now: Date,
  ): void {
    for (const group of this.state.groups.values()) {
      if (group.state === "FINISHED") continue;

      // Determine group's current hole from member positions
      const memberHoles: number[] = [];
      for (const sessionId of group.sessions) {
        const hole = holeDetections.get(sessionId);
        if (hole !== undefined && hole !== null) {
          memberHoles.push(hole);
        }
      }

      if (memberHoles.length > 0) {
        // Use median hole as group's current hole
        memberHoles.sort((a, b) => a - b);
        const medianHole = memberHoles[Math.floor(memberHoles.length / 2)]!;
        updateGroupHole(group, medianHole, now);
      }
    }
  }

  /**
   * Run a full engine tick — evaluate pace, gaps, bottlenecks, and alerts.
   */
  tick(now: Date): TickResult {
    const alerts: PaceAlert[] = [];
    const projectedFinishes = new Map<string, Date | null>();
    const ctx = { courseId: this.state.courseId, now };

    // 1. Calculate pace status for each group
    for (const group of this.state.groups.values()) {
      if (group.state === "FINISHED" || group.state === "FORMING") continue;

      const previousStatus = group.paceStatus;
      const result = calculatePaceStatus(group, this.holes, now);

      group.paceStatus = result.status;
      group.paceFactor = result.paceFactor;

      // Evaluate pace alerts
      const paceAlerts = evaluatePaceAlerts(group, result.deltaMinutes, previousStatus, ctx);
      alerts.push(...paceAlerts);

      // Calculate projected finish
      projectedFinishes.set(group.id, calculateProjectedFinish(group, this.holes, now));
    }

    // 2. Calculate gaps
    const gaps = calculateGaps(this.state.groups);
    for (const gap of gaps) {
      const groupBehind = this.state.groups.get(gap.groupBehindId);
      if (groupBehind) {
        const gapAlerts = evaluateGapAlerts(gap, groupBehind, ctx);
        alerts.push(...gapAlerts);
      }
    }

    // 3. Detect bottlenecks
    const bottleneckResult = detectBottlenecks(
      this.state.groups,
      this.holes,
      this.state.bottlenecks,
      now,
    );

    // Update bottleneck state
    const newBottlenecks = new Map<number, BottleneckState>();
    for (const bn of bottleneckResult.active) {
      newBottlenecks.set(bn.hole, bn);

      // Evaluate bottleneck alerts
      const bnAlerts = evaluateBottleneckAlerts(bn, this.state.groups, ctx);
      alerts.push(...bnAlerts);
    }
    this.state.bottlenecks = newBottlenecks;

    this.state.lastTick = now;

    return {
      groups: [...this.state.groups.values()],
      alerts,
      bottlenecks: bottleneckResult.active,
      projectedFinishes,
    };
  }

  /**
   * Re-evaluate group membership (call every 60s).
   */
  reevaluateMembers(
    memberStatuses: Map<string, MemberStatus[]>,
    now: Date,
  ): { abandoned: string[]; lostContact: string[] } {
    const allAbandoned: string[] = [];
    const allLostContact: string[] = [];

    for (const group of this.state.groups.values()) {
      if (group.state === "FINISHED") continue;

      const members = memberStatuses.get(group.id) ?? [];
      const result = reevaluateGroupMembership(group, members, now);
      allAbandoned.push(...result.abandoned);
      allLostContact.push(...result.lostContact);
    }

    return { abandoned: allAbandoned, lostContact: allLostContact };
  }

  // ── Getters ───────────────────────────────────────────────────────

  getGroups(): GroupState[] {
    return [...this.state.groups.values()];
  }

  getGroup(groupId: string): GroupState | undefined {
    return this.state.groups.get(groupId);
  }

  getState(): PaceEngineState {
    return this.state;
  }
}
