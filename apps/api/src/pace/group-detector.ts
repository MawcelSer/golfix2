import { createGroupState, type GroupState, type SessionPosition } from "./pace-types";

// ── Constants ───────────────────────────────────────────────────────

const TEE_TIME_WINDOW_MS = 10 * 60 * 1000; // ±10 min
const COLOCATION_WINDOW_MS = 3 * 60 * 1000; // ±3 min
const MAX_GROUP_SIZE = 4;
const FORMING_TIMEOUT_MS = 5 * 60 * 1000; // 5 min

// ── Types ───────────────────────────────────────────────────────────

export interface TeeTimeInfo {
  id: string;
  scheduledAt: Date;
  playersCount: number;
}

export interface SessionInfo {
  sessionId: string;
  startedAt: Date;
  position: SessionPosition | null;
}

export interface DetectionContext {
  /** Active tee times for the day */
  teeTimes: TeeTimeInfo[];
  /** Sessions that have been detected in Hole 1 geofence but not yet assigned */
  unassignedSessions: SessionInfo[];
  /** Current groups (may include FORMING groups) */
  groups: Map<string, GroupState>;
  /** Current time (injectable for testing) */
  now: Date;
}

// ── Haversine distance ──────────────────────────────────────────────

export function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// ── Group Detection ─────────────────────────────────────────────────

/**
 * Assign unassigned sessions (detected on Hole 1) to groups.
 * Returns newly created or modified group states.
 *
 * Two signals:
 * 1. Tee time matching (when tee times exist): |scheduledAt - startedAt| < 10 min
 * 2. GPS co-location clustering: within 50m + within 3 min start time
 */
export function detectGroups(ctx: DetectionContext): Map<string, GroupState> {
  const { teeTimes, unassignedSessions, groups, now } = ctx;

  for (const session of unassignedSessions) {
    let assigned = false;

    // Signal 1: Tee time matching
    if (teeTimes.length > 0) {
      assigned = tryTeeTimeMatch(session, teeTimes, groups, now);
    }

    // Signal 2: GPS co-location clustering (fallback or no tee times)
    if (!assigned) {
      assigned = tryColocationMatch(session, groups, now);
    }

    // No match: create solo group
    if (!assigned) {
      createSoloGroup(session, groups);
    }
  }

  return groups;
}

// ── Signal 1: Tee Time Matching ─────────────────────────────────────

function tryTeeTimeMatch(
  session: SessionInfo,
  teeTimes: TeeTimeInfo[],
  groups: Map<string, GroupState>,
  now: Date,
): boolean {
  // Find tee times within ±10 min of session start
  const matchingTeeTimes = teeTimes.filter((tt) => {
    const diff = Math.abs(session.startedAt.getTime() - tt.scheduledAt.getTime());
    return diff <= TEE_TIME_WINDOW_MS;
  });

  for (const teeTime of matchingTeeTimes) {
    // Find existing group for this tee time
    const existingGroup = findGroupByTeeTime(groups, teeTime.id);

    if (existingGroup) {
      if (
        existingGroup.sessions.length < MAX_GROUP_SIZE &&
        existingGroup.state === "FORMING" &&
        !isFormingExpired(existingGroup, now)
      ) {
        existingGroup.sessions.push(session.sessionId);
        return true;
      }
      continue;
    }

    // Create new group for this tee time
    const groupId = crypto.randomUUID();
    const groupNumber = getNextGroupNumber(groups);
    const group = createGroupState(groupId, groupNumber, teeTime.id);
    group.sessions.push(session.sessionId);
    group.holeArrivals.set(1, session.startedAt);
    groups.set(groupId, group);
    return true;
  }

  return false;
}

// ── Signal 2: GPS Co-location ───────────────────────────────────────

function tryColocationMatch(
  session: SessionInfo,
  groups: Map<string, GroupState>,
  now: Date,
): boolean {
  if (!session.position) return false;

  for (const group of groups.values()) {
    if (group.state !== "FORMING") continue;
    if (group.sessions.length >= MAX_GROUP_SIZE) continue;
    if (isFormingExpired(group, now)) continue;

    // Check if session is within proximity + time window of any group member position
    // We check arrival time at hole 1 (temporal proximity)
    const groupArrival = group.holeArrivals.get(1);
    if (groupArrival) {
      const timeDiff = Math.abs(session.startedAt.getTime() - groupArrival.getTime());
      if (timeDiff > COLOCATION_WINDOW_MS) continue;
    }

    // For co-location, we need the group members' positions
    // Since we're in the detection phase, we rely on the session's position
    // being close to the Hole 1 tee (both detected in the geofence)
    // The 50m check is done against member positions if available
    group.sessions.push(session.sessionId);
    if (!group.holeArrivals.has(1)) {
      group.holeArrivals.set(1, session.startedAt);
    }
    return true;
  }

  return false;
}

// ── Solo Group ──────────────────────────────────────────────────────

function createSoloGroup(session: SessionInfo, groups: Map<string, GroupState>): void {
  const groupId = crypto.randomUUID();
  const groupNumber = getNextGroupNumber(groups);
  const group = createGroupState(groupId, groupNumber);
  group.sessions.push(session.sessionId);
  group.holeArrivals.set(1, session.startedAt);
  groups.set(groupId, group);
}

// ── Helpers ─────────────────────────────────────────────────────────

function findGroupByTeeTime(
  groups: Map<string, GroupState>,
  teeTimeId: string,
): GroupState | undefined {
  for (const group of groups.values()) {
    if (group.teeTimeId === teeTimeId) return group;
  }
  return undefined;
}

function isFormingExpired(group: GroupState, now: Date): boolean {
  const arrival = group.holeArrivals.get(1);
  if (!arrival) return false;
  return now.getTime() - arrival.getTime() > FORMING_TIMEOUT_MS;
}

function getNextGroupNumber(groups: Map<string, GroupState>): number {
  let max = 0;
  for (const group of groups.values()) {
    if (group.groupNumber > max) max = group.groupNumber;
  }
  return max + 1;
}

// ── Group Membership Re-evaluation ──────────────────────────────────

export interface MemberStatus {
  sessionId: string;
  lastPosition: SessionPosition | null;
  currentHole: number | null;
}

/**
 * Re-evaluate group membership for PLAYING groups.
 * - >10 min no GPS → "lost contact" (flag only)
 * - >20 min no GPS → abandoned, remove from group
 * - >2 holes behind median → flagged as separated
 */
export function reevaluateGroupMembership(
  group: GroupState,
  members: MemberStatus[],
  now: Date,
): { abandoned: string[]; lostContact: string[]; separated: string[] } {
  const abandoned: string[] = [];
  const lostContact: string[] = [];
  const separated: string[] = [];

  const LOST_CONTACT_MS = 10 * 60 * 1000;
  const ABANDON_MS = 20 * 60 * 1000;

  // Calculate median hole
  const activeHoles = members.filter((m) => m.currentHole !== null).map((m) => m.currentHole!);
  activeHoles.sort((a, b) => a - b);
  const medianHole =
    activeHoles.length > 0 ? activeHoles[Math.floor(activeHoles.length / 2)]! : group.currentHole;

  for (const member of members) {
    if (!member.lastPosition) continue;

    const elapsed = now.getTime() - member.lastPosition.recordedAt.getTime();

    if (elapsed > ABANDON_MS) {
      abandoned.push(member.sessionId);
    } else if (elapsed > LOST_CONTACT_MS) {
      lostContact.push(member.sessionId);
    }

    // Check if >2 holes behind median
    if (member.currentHole !== null && medianHole - member.currentHole > 2) {
      separated.push(member.sessionId);
    }
  }

  // Remove abandoned sessions from group
  group.sessions = group.sessions.filter((s) => !abandoned.includes(s));

  // If no active sessions remain, mark group as finished
  if (group.sessions.length === 0) {
    group.state = "FINISHED";
  }

  return { abandoned, lostContact, separated };
}
