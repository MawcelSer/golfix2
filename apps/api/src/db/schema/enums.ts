import { pgEnum } from "drizzle-orm/pg-core";

export const courseRoleEnum = pgEnum("course_role", ["owner", "admin", "marshal", "viewer"]);

export const hazardTypeEnum = pgEnum("hazard_type", [
  "bunker",
  "water",
  "ob",
  "lateral",
  "tree_line",
]);

export const paceStatusEnum = pgEnum("pace_status", ["ahead", "on_pace", "attention", "behind"]);

export const sessionStatusEnum = pgEnum("session_status", ["active", "finished", "abandoned"]);

export const roundStatusEnum = pgEnum("round_status", ["in_progress", "completed", "abandoned"]);

export const paceEventTypeEnum = pgEnum("pace_event_type", [
  "behind_pace",
  "gap_compression",
  "gap_severe",
  "bottleneck",
  "reminder_sent",
]);

export const paceEventSeverityEnum = pgEnum("pace_event_severity", ["info", "warning", "critical"]);
