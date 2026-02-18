import type { GroupState, GapInfo, GapSeverity } from "./pace-types";

// ── Constants ───────────────────────────────────────────────────────

const GAP_COMPRESSION_MIN = 5;
const GAP_SEVERE_MIN = 2;
const GAP_LAGGING_MIN = 15;

// ── Gap Calculation ─────────────────────────────────────────────────

/**
 * Calculate gaps between consecutive groups on the course.
 *
 * Groups are ordered by group number (tee-off order).
 * For each pair (groupAhead, groupBehind), we compute "same-hole gap time":
 * how far behind groupBehind is at the same physical hole.
 *
 * @param groups  All active groups, keyed by ID
 * @returns       Array of gap measurements
 */
export function calculateGaps(groups: Map<string, GroupState>): GapInfo[] {
  const activeGroups = [...groups.values()]
    .filter((g) => g.state !== "FINISHED" && g.state !== "FORMING")
    .sort((a, b) => a.groupNumber - b.groupNumber);

  if (activeGroups.length < 2) return [];

  const gaps: GapInfo[] = [];

  for (let i = 1; i < activeGroups.length; i++) {
    const groupAhead = activeGroups[i - 1]!;
    const groupBehind = activeGroups[i]!;

    const gap = calculatePairGap(groupAhead, groupBehind);
    if (gap !== null) {
      gaps.push(gap);
    }
  }

  return gaps;
}

/**
 * Calculate gap between two consecutive groups using same-hole arrival times.
 *
 * Measurement: find the latest hole that groupBehind has reached,
 * then compare arrival times at that hole.
 */
function calculatePairGap(groupAhead: GroupState, groupBehind: GroupState): GapInfo | null {
  // Use groupBehind's current hole as the reference point
  const referenceHole = groupBehind.currentHole;

  const arrivalAhead = groupAhead.holeArrivals.get(referenceHole);
  const arrivalBehind = groupBehind.holeArrivals.get(referenceHole);

  if (!arrivalAhead || !arrivalBehind) {
    // Can't measure — one group hasn't reached this hole
    // Try previous holes as fallback
    return calculateFallbackGap(groupAhead, groupBehind);
  }

  const gapMs = arrivalBehind.getTime() - arrivalAhead.getTime();
  const gapMinutes = gapMs / 60000;

  const severity = classifyGap(gapMinutes);
  const direction = determineDirection(groupAhead, groupBehind, referenceHole);

  return {
    groupAheadId: groupAhead.id,
    groupBehindId: groupBehind.id,
    gapMinutes,
    severity,
    direction,
    measuredAtHole: referenceHole,
  };
}

/**
 * Fallback: find the highest hole both groups have visited.
 */
function calculateFallbackGap(groupAhead: GroupState, groupBehind: GroupState): GapInfo | null {
  // Find the highest hole number where both have arrival data
  let bestHole = 0;

  for (const [hole] of groupBehind.holeArrivals) {
    if (groupAhead.holeArrivals.has(hole) && hole > bestHole) {
      bestHole = hole;
    }
  }

  if (bestHole === 0) return null;

  const arrivalAhead = groupAhead.holeArrivals.get(bestHole)!;
  const arrivalBehind = groupBehind.holeArrivals.get(bestHole)!;

  const gapMs = arrivalBehind.getTime() - arrivalAhead.getTime();
  const gapMinutes = gapMs / 60000;

  const severity = classifyGap(gapMinutes);
  const direction = determineDirection(groupAhead, groupBehind, bestHole);

  return {
    groupAheadId: groupAhead.id,
    groupBehindId: groupBehind.id,
    gapMinutes,
    severity,
    direction,
    measuredAtHole: bestHole,
  };
}

// ── Gap Classification ──────────────────────────────────────────────

function classifyGap(gapMinutes: number): GapSeverity {
  if (gapMinutes < GAP_SEVERE_MIN) return "severe_compression";
  if (gapMinutes < GAP_COMPRESSION_MIN) return "compression";
  if (gapMinutes > GAP_LAGGING_MIN) return "lagging";
  return "normal";
}

// ── Gap Direction ───────────────────────────────────────────────────

/**
 * Determine if the gap is closing (groupBehind catching up),
 * stable, or widening.
 *
 * Compare gap at the current reference hole vs the previous hole.
 */
function determineDirection(
  groupAhead: GroupState,
  groupBehind: GroupState,
  currentHole: number,
): "closing" | "stable" | "widening" {
  const previousHole = currentHole - 1;
  if (previousHole < 1) return "stable";

  const prevArrivalAhead = groupAhead.holeArrivals.get(previousHole);
  const prevArrivalBehind = groupBehind.holeArrivals.get(previousHole);

  if (!prevArrivalAhead || !prevArrivalBehind) return "stable";

  const currArrivalAhead = groupAhead.holeArrivals.get(currentHole);
  const currArrivalBehind = groupBehind.holeArrivals.get(currentHole);

  if (!currArrivalAhead || !currArrivalBehind) return "stable";

  const prevGapMs = prevArrivalBehind.getTime() - prevArrivalAhead.getTime();
  const currGapMs = currArrivalBehind.getTime() - currArrivalAhead.getTime();

  const deltaMs = currGapMs - prevGapMs;
  const deltaMinutes = deltaMs / 60000;

  // Threshold: >1 min change is significant
  if (deltaMinutes < -1) return "closing";
  if (deltaMinutes > 1) return "widening";
  return "stable";
}
