import type { GroupState, PaceAlert, GapInfo, PaceStatus } from "./pace-types";
import type { BottleneckState } from "./bottleneck-detector";

// ── Cooldown Durations (ms) ─────────────────────────────────────────

const COOLDOWNS = {
  behind_pace_first: 15 * 60 * 1000,
  behind_pace_post_reminder: 15 * 60 * 1000,
  behind_pace_escalated: 20 * 60 * 1000,
  gap_compression: 10 * 60 * 1000,
  bottleneck: 10 * 60 * 1000,
  gap_severe: 5 * 60 * 1000,
  bottleneck_critical: 5 * 60 * 1000,
};

// ── Alert Engine ────────────────────────────────────────────────────

export interface AlertEngineContext {
  courseId: string;
  now: Date;
}

/**
 * Evaluate alert rules for a group's pace status.
 * Handles cooldown and escalation logic.
 *
 * @returns Array of alerts to emit (may be empty if in cooldown)
 */
export function evaluatePaceAlerts(
  group: GroupState,
  deltaMinutes: number,
  previousStatus: PaceStatus,
  ctx: AlertEngineContext,
): PaceAlert[] {
  const alerts: PaceAlert[] = [];
  const { alertState } = group;

  // Recovery: group went from behind/attention to on_pace
  if (
    group.paceStatus === "on_pace" &&
    (previousStatus === "behind" || previousStatus === "attention")
  ) {
    alerts.push(createAlert("behind_pace", "info", group, ctx, { delta: 0, resolved: true }));
    // Clear alert state
    alertState.lastAlertType = null;
    alertState.lastAlertTime = null;
    alertState.escalationLevel = 0;
    return alerts;
  }

  // Behind pace alert with escalation
  if (group.paceStatus === "behind") {
    if (isInCooldown(alertState, "behind_pace", ctx.now)) {
      return alerts;
    }

    const severity = alertState.escalationLevel >= 2 ? "critical" : "warning";
    const escalation = Math.min(alertState.escalationLevel + 1, 3);

    alerts.push(
      createAlert("behind_pace", severity, group, ctx, {
        delta: Math.round(deltaMinutes),
        escalationLevel: escalation,
      }),
    );

    alertState.lastAlertType = "behind_pace";
    alertState.lastAlertTime = ctx.now;
    alertState.escalationLevel = escalation;
  }

  return alerts;
}

/**
 * Evaluate gap compression alerts.
 */
export function evaluateGapAlerts(
  gap: GapInfo,
  groupBehind: GroupState,
  ctx: AlertEngineContext,
): PaceAlert[] {
  const alerts: PaceAlert[] = [];

  if (gap.severity === "severe_compression") {
    if (!isInCooldown(groupBehind.alertState, "gap_severe", ctx.now)) {
      alerts.push(
        createAlert("gap_severe", "critical", groupBehind, ctx, {
          gapMinutes: Math.round(gap.gapMinutes),
          groupAheadId: gap.groupAheadId,
          direction: gap.direction,
        }),
      );
      groupBehind.alertState.lastAlertType = "gap_severe";
      groupBehind.alertState.lastAlertTime = ctx.now;
    }
  } else if (gap.severity === "compression") {
    if (!isInCooldown(groupBehind.alertState, "gap_compression", ctx.now)) {
      alerts.push(
        createAlert("gap_compression", "warning", groupBehind, ctx, {
          gapMinutes: Math.round(gap.gapMinutes),
          groupAheadId: gap.groupAheadId,
          direction: gap.direction,
        }),
      );
      groupBehind.alertState.lastAlertType = "gap_compression";
      groupBehind.alertState.lastAlertTime = ctx.now;
    }
  }

  return alerts;
}

/**
 * Evaluate bottleneck alerts.
 */
export function evaluateBottleneckAlerts(
  bottleneck: BottleneckState,
  groups: Map<string, GroupState>,
  ctx: AlertEngineContext,
): PaceAlert[] {
  const alerts: PaceAlert[] = [];

  if (bottleneck.alertEmitted) return alerts;
  if (bottleneck.resolvedAt !== null) return alerts;

  const blockerGroup = groups.get(bottleneck.blockerGroupId);
  if (!blockerGroup) return alerts;

  const durationMs = ctx.now.getTime() - bottleneck.startedAt.getTime();
  const overlapMinutes = Math.round(durationMs / 60000);
  const severity = bottleneck.isCascade ? "info" : "warning";

  alerts.push(
    createAlert("bottleneck", severity, blockerGroup, ctx, {
      blockerGroupId: bottleneck.blockerGroupId,
      isCascade: bottleneck.isCascade,
      rootHole: bottleneck.rootHole,
      overlapMinutes,
      bottleneckHole: bottleneck.hole,
    }),
  );

  bottleneck.alertEmitted = true;

  return alerts;
}

/**
 * Record that a manager sent a pace reminder to a group.
 * Resets the cooldown and sets escalation level.
 */
export function recordReminder(group: GroupState, ctx: AlertEngineContext): PaceAlert {
  group.alertState.lastReminderTime = ctx.now;
  group.alertState.lastAlertTime = ctx.now; // Reset cooldown
  group.alertState.escalationLevel = 2; // Post-reminder level

  return createAlert("reminder_sent", "info", group, ctx, {
    sentAt: ctx.now.toISOString(),
  });
}

// ── Cooldown Logic ──────────────────────────────────────────────────

function isInCooldown(alertState: GroupState["alertState"], alertType: string, now: Date): boolean {
  if (!alertState.lastAlertTime) return false;

  // Different alert types don't block each other
  if (alertState.lastAlertType !== alertType && alertState.lastAlertType !== null) {
    // But gap_severe and gap_compression share cooldown
    const gapTypes = new Set(["gap_severe", "gap_compression"]);
    if (!gapTypes.has(alertType) || !gapTypes.has(alertState.lastAlertType)) {
      return false;
    }
  }

  const elapsed = now.getTime() - alertState.lastAlertTime.getTime();
  const cooldown = getCooldown(alertType, alertState.escalationLevel);

  return elapsed < cooldown;
}

function getCooldown(alertType: string, escalationLevel: number): number {
  switch (alertType) {
    case "behind_pace":
      if (escalationLevel >= 2) return COOLDOWNS.behind_pace_escalated;
      return COOLDOWNS.behind_pace_first;
    case "gap_compression":
      return COOLDOWNS.gap_compression;
    case "gap_severe":
      return COOLDOWNS.gap_severe;
    case "bottleneck":
      return COOLDOWNS.bottleneck;
    default:
      return COOLDOWNS.behind_pace_first;
  }
}

// ── Alert Factory ───────────────────────────────────────────────────

function createAlert(
  type: PaceAlert["type"],
  severity: PaceAlert["severity"],
  group: GroupState,
  ctx: AlertEngineContext,
  details: Record<string, unknown>,
): PaceAlert {
  return {
    type,
    severity,
    courseId: ctx.courseId,
    groupId: group.id,
    groupNumber: group.groupNumber,
    currentHole: group.currentHole,
    details,
    timestamp: ctx.now,
  };
}
