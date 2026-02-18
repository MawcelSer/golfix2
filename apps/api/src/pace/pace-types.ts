// ── Pace Status ─────────────────────────────────────────────────────

export type PaceStatus = "ahead" | "on_pace" | "attention" | "behind";

export type GroupLifecycle = "FORMING" | "PLAYING" | "IN_TRANSIT" | "FINISHED";

// ── Group State ─────────────────────────────────────────────────────

export interface AlertState {
  lastAlertType: string | null;
  lastAlertTime: Date | null;
  lastReminderTime: Date | null;
  escalationLevel: number; // 0=none, 1=first, 2=post-reminder, 3=critical
}

export interface GroupState {
  id: string;
  groupNumber: number;
  teeTimeId: string | null;
  sessions: string[];
  state: GroupLifecycle;
  currentHole: number;
  paceStartTime: Date | null;
  paceStatus: PaceStatus;
  paceFactor: number;
  holeArrivals: Map<number, Date>;
  alertState: AlertState;
}

// ── Hole Data ───────────────────────────────────────────────────────

export interface HoleData {
  holeNumber: number;
  par: number;
  paceTargetMinutes: number | null;
  transitionMinutes: number;
}

// ── Gap Info ────────────────────────────────────────────────────────

export type GapSeverity = "compression" | "severe_compression" | "normal" | "lagging";

export interface GapInfo {
  groupBehindId: string;
  groupAheadId: string;
  gapMinutes: number;
  severity: GapSeverity;
  /** Is the gap shrinking because group B is fast, or because group A is slow? */
  direction: "closing" | "stable" | "widening";
  measuredAtHole: number;
}

// ── Alert Payload ───────────────────────────────────────────────────

export interface PaceAlert {
  type: "behind_pace" | "gap_compression" | "gap_severe" | "bottleneck" | "reminder_sent";
  severity: "info" | "warning" | "critical";
  courseId: string;
  groupId: string;
  groupNumber: number;
  currentHole: number;
  details: Record<string, unknown>;
  timestamp: Date;
}

// ── Session Position ────────────────────────────────────────────────

export interface SessionPosition {
  sessionId: string;
  lat: number;
  lng: number;
  recordedAt: Date;
}

// ── Default play times (minutes) by par ─────────────────────────────

export const DEFAULT_PLAY_TIMES: Record<number, number> = {
  3: 10,
  4: 14,
  5: 18,
};

export function getExpectedPlayTime(hole: HoleData): number {
  if (hole.paceTargetMinutes !== null) return hole.paceTargetMinutes;
  return DEFAULT_PLAY_TIMES[hole.par] ?? 14;
}

export function getExpectedHoleTime(hole: HoleData): number {
  return getExpectedPlayTime(hole) + hole.transitionMinutes;
}

export function getCumulativeExpectedTime(holes: HoleData[], throughHole: number): number {
  let total = 0;
  for (const hole of holes) {
    if (hole.holeNumber > throughHole) break;
    total += getExpectedHoleTime(hole);
  }
  return total;
}

// ── Helper: fresh alert state ───────────────────────────────────────

export function createAlertState(): AlertState {
  return {
    lastAlertType: null,
    lastAlertTime: null,
    lastReminderTime: null,
    escalationLevel: 0,
  };
}

// ── Helper: fresh group state ───────────────────────────────────────

export function createGroupState(
  id: string,
  groupNumber: number,
  teeTimeId: string | null = null,
): GroupState {
  return {
    id,
    groupNumber,
    teeTimeId,
    sessions: [],
    state: "FORMING",
    currentHole: 1,
    paceStartTime: null,
    paceStatus: "on_pace",
    paceFactor: 1.0,
    holeArrivals: new Map(),
    alertState: createAlertState(),
  };
}
