import { sql } from "drizzle-orm";
import {
  check,
  decimal,
  geometry,
  index,
  jsonb,
  pgTable,
  smallint,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { courseRoleEnum, hazardTypeEnum } from "./enums";

// ── users ──────────────────────────────────────────────────────────

export const users = pgTable(
  "users",
  {
    id: uuid().primaryKey().defaultRandom(),
    email: varchar({ length: 255 }),
    displayName: varchar("display_name", { length: 100 }).notNull(),
    passwordHash: varchar("password_hash", { length: 255 }),
    deviceId: varchar("device_id", { length: 100 }),
    handicapIndex: decimal("handicap_index", { precision: 3, scale: 1 }),
    pushToken: varchar("push_token", { length: 500 }),
    pushSubscription: jsonb("push_subscription"),
    notificationPrefs: jsonb("notification_prefs")
      .default(sql`'{"pace_reminders": true}'::jsonb`)
      .notNull(),
    gdprConsentAt: timestamp("gdpr_consent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    check("users_identity_check", sql`${t.email} IS NOT NULL OR ${t.deviceId} IS NOT NULL`),
  ],
);

// ── courses ────────────────────────────────────────────────────────

export const courses = pgTable(
  "courses",
  {
    id: uuid().primaryKey().defaultRandom(),
    name: varchar({ length: 200 }).notNull(),
    slug: varchar({ length: 100 }).notNull().unique(),
    boundary: geometry("boundary", { type: "polygon", srid: 4326 }),
    address: varchar({ length: 500 }),
    city: varchar({ length: 100 }),
    country: varchar({ length: 2 }).default("FR").notNull(),
    holesCount: smallint("holes_count").notNull(),
    par: smallint().notNull(),
    paceTargetMinutes: smallint("pace_target_minutes").notNull(),
    teeIntervalMinutes: smallint("tee_interval_minutes").default(8).notNull(),
    timezone: varchar({ length: 50 }).default("Europe/Paris").notNull(),
    dataVersion: smallint("data_version").default(1).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("idx_courses_boundary").using("gist", t.boundary)],
);

// ── course_roles ───────────────────────────────────────────────────

export const courseRoles = pgTable(
  "course_roles",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id),
    role: courseRoleEnum().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    unique("course_roles_user_course_unique").on(t.userId, t.courseId),
    index("idx_course_roles_user").on(t.userId),
    index("idx_course_roles_course").on(t.courseId),
  ],
);

// ── holes ──────────────────────────────────────────────────────────

export const holes = pgTable(
  "holes",
  {
    id: uuid().primaryKey().defaultRandom(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id),
    holeNumber: smallint("hole_number").notNull(),
    par: smallint().notNull(),
    strokeIndex: smallint("stroke_index").notNull(),
    distanceMeters: smallint("distance_meters").notNull(),
    geofence: geometry("geofence", { type: "polygon", srid: 4326 }),
    teePosition: geometry("tee_position", { type: "point", mode: "xy", srid: 4326 }),
    greenCenter: geometry("green_center", { type: "point", mode: "xy", srid: 4326 }),
    greenFront: geometry("green_front", { type: "point", mode: "xy", srid: 4326 }),
    greenBack: geometry("green_back", { type: "point", mode: "xy", srid: 4326 }),
    paceTargetMinutes: smallint("pace_target_minutes"),
    transitionMinutes: smallint("transition_minutes").default(1).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    unique("holes_course_number_unique").on(t.courseId, t.holeNumber),
    index("idx_holes_geofence").using("gist", t.geofence),
    index("idx_holes_green_center").using("gist", t.greenCenter),
  ],
);

// ── hazards ────────────────────────────────────────────────────────

export const hazards = pgTable(
  "hazards",
  {
    id: uuid().primaryKey().defaultRandom(),
    holeId: uuid("hole_id")
      .notNull()
      .references(() => holes.id),
    type: hazardTypeEnum().notNull(),
    name: varchar({ length: 100 }),
    geometry: geometry("geometry", { type: "polygon", srid: 4326 }),
    carryPoint: geometry("carry_point", { type: "point", mode: "xy", srid: 4326 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("idx_hazards_geometry").using("gist", t.geometry)],
);
