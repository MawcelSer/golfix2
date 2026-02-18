import {
  type GroupState,
  type HoleData,
  type PaceStatus,
  getCumulativeExpectedTime,
  getExpectedHoleTime,
} from "./pace-types";

// ── Constants ───────────────────────────────────────────────────────

/** Hysteresis thresholds (minutes) */
const THRESHOLDS = {
  // Entry conditions
  ahead_entry: -3,
  attention_entry: 3,
  behind_entry: 8,

  // Exit conditions (must improve past this to downgrade)
  ahead_exit: -2,
  attention_exit: 2,
  behind_exit: 6,
};

/** EWMA smoothing factor (weight toward recent data) */
const EWMA_ALPHA = 0.3;

/** Pace factor bounds */
const MIN_PACE_FACTOR = 0.7;
const MAX_PACE_FACTOR = 1.5;

// ── Pace Status Calculation ─────────────────────────────────────────

/**
 * Calculate pace status for a group with hysteresis to prevent flickering.
 *
 * @param group      Current group state
 * @param holes      Sorted hole data for the course
 * @param now        Current time (injectable for testing)
 * @returns          Updated pace status and delta minutes
 */
export function calculatePaceStatus(
  group: GroupState,
  holes: HoleData[],
  now: Date,
): { status: PaceStatus; deltaMinutes: number; paceFactor: number } {
  if (!group.paceStartTime || group.state === "FORMING" || group.state === "FINISHED") {
    return { status: "on_pace", deltaMinutes: 0, paceFactor: 1.0 };
  }

  const elapsedMs = now.getTime() - group.paceStartTime.getTime();
  const elapsedMinutes = elapsedMs / 60000;

  const expectedMinutes = getCumulativeExpectedTime(holes, group.currentHole);

  if (expectedMinutes === 0) {
    return { status: "on_pace", deltaMinutes: 0, paceFactor: 1.0 };
  }

  // delta > 0 = behind schedule, delta < 0 = ahead
  const deltaMinutes = elapsedMinutes - expectedMinutes;

  // Calculate raw pace factor
  const rawPaceFactor = elapsedMinutes / expectedMinutes;

  // Apply EWMA smoothing
  const smoothedPaceFactor = EWMA_ALPHA * rawPaceFactor + (1 - EWMA_ALPHA) * group.paceFactor;

  // Clamp pace factor
  const paceFactor = Math.max(MIN_PACE_FACTOR, Math.min(MAX_PACE_FACTOR, smoothedPaceFactor));

  // Apply hysteresis for status transitions
  const status = applyHysteresis(group.paceStatus, deltaMinutes);

  return { status, deltaMinutes, paceFactor };
}

/**
 * Apply hysteresis to prevent flickering between states.
 * Uses asymmetric entry/exit thresholds.
 */
function applyHysteresis(currentStatus: PaceStatus, deltaMinutes: number): PaceStatus {
  switch (currentStatus) {
    case "ahead":
      // To exit Ahead → On Pace: delta must rise above -2
      if (deltaMinutes > THRESHOLDS.ahead_exit) {
        // Check if should go directly to Attention or Behind
        if (deltaMinutes > THRESHOLDS.behind_entry) return "behind";
        if (deltaMinutes > THRESHOLDS.attention_entry) return "attention";
        return "on_pace";
      }
      return "ahead";

    case "on_pace":
      if (deltaMinutes < THRESHOLDS.ahead_entry) return "ahead";
      if (deltaMinutes > THRESHOLDS.behind_entry) return "behind";
      if (deltaMinutes > THRESHOLDS.attention_entry) return "attention";
      return "on_pace";

    case "attention":
      // To downgrade to On Pace: delta must drop below +2
      if (deltaMinutes < THRESHOLDS.attention_exit) {
        if (deltaMinutes < THRESHOLDS.ahead_entry) return "ahead";
        return "on_pace";
      }
      // To escalate to Behind
      if (deltaMinutes > THRESHOLDS.behind_entry) return "behind";
      return "attention";

    case "behind":
      // To downgrade to Attention: delta must drop below +6
      if (deltaMinutes < THRESHOLDS.behind_exit) {
        if (deltaMinutes < THRESHOLDS.attention_exit) {
          if (deltaMinutes < THRESHOLDS.ahead_entry) return "ahead";
          return "on_pace";
        }
        return "attention";
      }
      return "behind";

    default:
      return "on_pace";
  }
}

// ── Projected Finish Time ───────────────────────────────────────────

/**
 * Calculate projected finish time for a group.
 *
 * @param group  Current group state
 * @param holes  Sorted hole data for the course
 * @param now    Current time
 * @returns      Projected finish date, or null if insufficient data
 */
export function calculateProjectedFinish(
  group: GroupState,
  holes: HoleData[],
  now: Date,
): Date | null {
  if (!group.paceStartTime || group.state === "FINISHED") return null;
  if (group.currentHole <= 1) return null; // Not enough data

  const totalHoles = holes.length;
  if (group.currentHole >= totalHoles) return null; // Already finished

  // Calculate remaining expected time
  let remainingExpected = 0;
  for (const hole of holes) {
    if (hole.holeNumber > group.currentHole) {
      remainingExpected += getExpectedHoleTime(hole);
    }
  }

  // Apply pace factor (clamped)
  const paceFactor = Math.max(MIN_PACE_FACTOR, Math.min(MAX_PACE_FACTOR, group.paceFactor));
  const projectedRemainingMs = remainingExpected * paceFactor * 60000;

  return new Date(now.getTime() + projectedRemainingMs);
}

// ── Update Group Hole ───────────────────────────────────────────────

/**
 * Update a group's current hole based on member positions.
 * Records hole arrival time if transitioning to a new hole.
 *
 * @param group      Group state to update
 * @param detectedHole  The hole number detected for the group's median position
 * @param now        Current time
 * @returns          Whether the hole changed
 */
export function updateGroupHole(group: GroupState, detectedHole: number, now: Date): boolean {
  if (detectedHole === group.currentHole) return false;

  const previousHole = group.currentHole;
  group.currentHole = detectedHole;

  // Record arrival at new hole
  if (!group.holeArrivals.has(detectedHole)) {
    group.holeArrivals.set(detectedHole, now);
  }

  // State transitions
  if (group.state === "FORMING" && detectedHole > 1) {
    // First member moved beyond Hole 1 tee → start pace clock
    group.state = "PLAYING";
    group.paceStartTime = group.holeArrivals.get(1) ?? now;
  } else if (group.state === "PLAYING" && detectedHole > previousHole) {
    // Transitioning between holes (could briefly be IN_TRANSIT)
    group.state = "PLAYING";
  }

  return true;
}

/**
 * Start the pace clock for a group transitioning from FORMING to PLAYING.
 * Called when the first member moves beyond Hole 1 tee area.
 */
export function startPaceClock(group: GroupState, now: Date): void {
  if (group.state !== "FORMING") return;

  group.state = "PLAYING";
  group.paceStartTime = group.holeArrivals.get(1) ?? now;
}
