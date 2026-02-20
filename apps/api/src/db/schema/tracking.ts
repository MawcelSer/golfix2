import {
  bigserial,
  boolean,
  date,
  geometry,
  index,
  jsonb,
  pgTable,
  real,
  smallint,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import {
  paceEventSeverityEnum,
  paceEventTypeEnum,
  paceStatusEnum,
  roundStatusEnum,
  sessionStatusEnum,
} from "./enums";
import { courses, users } from "./core";

// ── tee_times ──────────────────────────────────────────────────────

export const teeTimes = pgTable(
  "tee_times",
  {
    id: uuid().primaryKey().defaultRandom(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    playersCount: smallint("players_count").default(4).notNull(),
    notes: varchar({ length: 500 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("idx_tee_times_course_date").on(t.courseId, t.scheduledAt)],
);

// ── groups ─────────────────────────────────────────────────────────

export const groups = pgTable(
  "groups",
  {
    id: uuid().primaryKey().defaultRandom(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id),
    teeTimeId: uuid("tee_time_id").references(() => teeTimes.id),
    date: date().notNull(),
    groupNumber: smallint("group_number").notNull(),
    currentHole: smallint("current_hole"),
    paceStatus: paceStatusEnum("pace_status").default("on_pace").notNull(),
    paceStartTime: timestamp("pace_start_time", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("idx_groups_course_date").on(t.courseId, t.date)],
);

// ── sessions ───────────────────────────────────────────────────────

export const sessions = pgTable(
  "sessions",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id), // Nullable for GDPR anonymization
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id),
    groupId: uuid("group_id").references(() => groups.id),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    currentHole: smallint("current_hole"),
    status: sessionStatusEnum().default("active").notNull(),
    positionSummary: jsonb("position_summary"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("idx_sessions_user").on(t.userId),
    index("idx_sessions_course_status").on(t.courseId, t.status),
  ],
);

// ── positions ──────────────────────────────────────────────────────
// Note: Monthly partitioning handled via custom migration SQL, not in Drizzle schema.

export const positions = pgTable(
  "positions",
  {
    id: bigserial({ mode: "number" }).primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id),
    location: geometry("location", { type: "point", mode: "xy", srid: 4326 }).notNull(),
    accuracy: real().notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("idx_positions_session").on(t.sessionId)],
);

// ── rounds ─────────────────────────────────────────────────────────

export const rounds = pgTable(
  "rounds",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    sessionId: uuid("session_id").references(() => sessions.id),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    totalScore: smallint("total_score"),
    totalPutts: smallint("total_putts"),
    status: roundStatusEnum().default("in_progress").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("idx_rounds_user").on(t.userId), index("idx_rounds_course").on(t.courseId)],
);

// ── scores ─────────────────────────────────────────────────────────

export const scores = pgTable(
  "scores",
  {
    id: uuid().primaryKey().defaultRandom(),
    roundId: uuid("round_id")
      .notNull()
      .references(() => rounds.id),
    holeNumber: smallint("hole_number").notNull(),
    strokes: smallint().notNull(),
    putts: smallint(),
    fairwayHit: boolean("fairway_hit"),
    greenInRegulation: boolean("green_in_regulation"),
  },
  (t) => [
    unique("scores_round_hole_unique").on(t.roundId, t.holeNumber),
    index("idx_scores_round").on(t.roundId),
  ],
);

// ── pace_events ────────────────────────────────────────────────────

export const paceEvents = pgTable(
  "pace_events",
  {
    id: uuid().primaryKey().defaultRandom(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id),
    groupId: uuid("group_id").references(() => groups.id),
    type: paceEventTypeEnum().notNull(),
    severity: paceEventSeverityEnum().notNull(),
    holeNumber: smallint("hole_number"),
    details: jsonb().notNull(),
    acknowledgedBy: uuid("acknowledged_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("idx_pace_events_course_date").on(t.courseId, t.createdAt)],
);

// ── refresh_tokens ─────────────────────────────────────────────────

export const refreshTokens = pgTable(
  "refresh_tokens",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    tokenHash: varchar("token_hash", { length: 255 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("idx_refresh_tokens_user").on(t.userId),
    index("idx_refresh_tokens_hash").on(t.tokenHash),
  ],
);
