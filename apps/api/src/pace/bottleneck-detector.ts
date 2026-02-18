import type { GroupState, HoleData } from "./pace-types";

// ── Types ───────────────────────────────────────────────────────────

export interface BottleneckState {
  hole: number;
  startedAt: Date;
  blockerGroupId: string;
  isCascade: boolean;
  rootHole: number | null;
  alertEmitted: boolean;
  resolvedAt: Date | null;
}

export interface BottleneckResult {
  active: BottleneckState[];
  resolved: BottleneckState[];
}

// ── Constants ───────────────────────────────────────────────────────

const PAR3_THRESHOLD_MS = 5 * 60 * 1000; // 5 min
const DEFAULT_THRESHOLD_MS = 3 * 60 * 1000; // 3 min for par 4/5

// ── Bottleneck Detection ────────────────────────────────────────────

/**
 * Detect bottlenecks: holes where 2+ groups are present simultaneously.
 *
 * Par-adjusted thresholds:
 * - Par 3: 2+ groups for >5 min (expected bunching on short holes)
 * - Par 4/5: 2+ groups for >3 min
 *
 * Also identifies root cause vs cascade for consecutive bottlenecked holes.
 *
 * @param groups          Active groups
 * @param holes           Course hole data (for par info)
 * @param prevBottlenecks Previous bottleneck state (for tracking duration)
 * @param now             Current time
 */
export function detectBottlenecks(
  groups: Map<string, GroupState>,
  holes: HoleData[],
  prevBottlenecks: Map<number, BottleneckState>,
  now: Date,
): BottleneckResult {
  // Build hole occupancy map: hole → groups present
  const holeOccupancy = buildHoleOccupancy(groups);

  // Build hole data lookup
  const holeMap = new Map<number, HoleData>();
  for (const hole of holes) {
    holeMap.set(hole.holeNumber, hole);
  }

  const activeBottlenecks: BottleneckState[] = [];
  const resolved: BottleneckState[] = [];

  // Check each hole for bottleneck condition
  const bottleneckedHoles = new Set<number>();

  for (const [holeNumber, groupIds] of holeOccupancy) {
    if (groupIds.length < 2) {
      // Check if previously bottlenecked → resolved
      const prev = prevBottlenecks.get(holeNumber);
      if (prev && prev.resolvedAt === null) {
        resolved.push({ ...prev, resolvedAt: now });
      }
      continue;
    }

    const holeData = holeMap.get(holeNumber);
    const threshold = holeData?.par === 3 ? PAR3_THRESHOLD_MS : DEFAULT_THRESHOLD_MS;

    // Find the blocker: the group that has been on this hole the longest
    const blocker = findBlocker(groups, groupIds, holeNumber);
    if (!blocker) continue;

    // Calculate overlap duration
    const prev = prevBottlenecks.get(holeNumber);
    const startedAt = prev?.startedAt ?? now;
    const duration = now.getTime() - startedAt.getTime();

    if (duration >= threshold) {
      bottleneckedHoles.add(holeNumber);
      activeBottlenecks.push({
        hole: holeNumber,
        startedAt,
        blockerGroupId: blocker.id,
        isCascade: false, // Will be set in root cause analysis
        rootHole: null,
        alertEmitted: prev?.alertEmitted ?? false,
        resolvedAt: null,
      });
    } else if (prev && prev.resolvedAt === null) {
      // Still building up, keep tracking
      activeBottlenecks.push({
        ...prev,
        blockerGroupId: blocker.id,
      });
    } else {
      // New potential bottleneck, not yet over threshold
      activeBottlenecks.push({
        hole: holeNumber,
        startedAt: now,
        blockerGroupId: blocker.id,
        isCascade: false,
        rootHole: null,
        alertEmitted: false,
        resolvedAt: null,
      });
    }
  }

  // Mark previously bottlenecked holes that aren't active anymore as resolved
  for (const [holeNumber, prev] of prevBottlenecks) {
    if (prev.resolvedAt !== null) continue;
    if (!holeOccupancy.has(holeNumber) || (holeOccupancy.get(holeNumber)?.length ?? 0) < 2) {
      if (!resolved.some((r) => r.hole === holeNumber)) {
        resolved.push({ ...prev, resolvedAt: now });
      }
    }
  }

  // Root cause analysis: identify cascade vs root bottlenecks
  identifyRootCause(activeBottlenecks, bottleneckedHoles);

  return { active: activeBottlenecks, resolved };
}

// ── Helpers ─────────────────────────────────────────────────────────

/**
 * Build a map of hole → group IDs currently on that hole.
 */
function buildHoleOccupancy(groups: Map<string, GroupState>): Map<number, string[]> {
  const occupancy = new Map<number, string[]>();

  for (const group of groups.values()) {
    if (group.state === "FINISHED" || group.state === "FORMING") continue;

    const existing = occupancy.get(group.currentHole) ?? [];
    existing.push(group.id);
    occupancy.set(group.currentHole, existing);
  }

  return occupancy;
}

/**
 * Find the group that has been on a hole the longest (the "blocker").
 */
function findBlocker(
  groups: Map<string, GroupState>,
  groupIds: string[],
  holeNumber: number,
): GroupState | null {
  let blocker: GroupState | null = null;
  let earliestArrival = Infinity;

  for (const id of groupIds) {
    const group = groups.get(id);
    if (!group) continue;

    const arrival = group.holeArrivals.get(holeNumber);
    if (arrival && arrival.getTime() < earliestArrival) {
      earliestArrival = arrival.getTime();
      blocker = group;
    }
  }

  return blocker;
}

/**
 * For consecutive bottlenecked holes, the foremost hole is the root cause.
 * Holes behind it are tagged as cascades.
 */
function identifyRootCause(bottlenecks: BottleneckState[], bottleneckedHoles: Set<number>): void {
  // Sort bottlenecks by hole number ascending
  const sorted = bottlenecks
    .filter((b) => bottleneckedHoles.has(b.hole))
    .sort((a, b) => a.hole - b.hole);

  for (const bn of sorted) {
    // If the hole ahead (lower number) is also bottlenecked → this is a cascade
    if (bottleneckedHoles.has(bn.hole - 1)) {
      bn.isCascade = true;
      // Find the root: trace back until no bottleneck ahead
      let root = bn.hole - 1;
      while (bottleneckedHoles.has(root - 1)) {
        root--;
      }
      bn.rootHole = root;
    }
  }
}
