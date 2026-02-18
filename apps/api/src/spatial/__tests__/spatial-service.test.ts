import { describe, it, expect, beforeAll } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "../../db/connection";
import { isOnCourse, detectHole, distanceToGreen } from "../spatial-service";

// ── Test data resolved from the seeded DB ──────────────────────────

let courseId: string;
let hole1Id: string;
let hole1DistanceMeters: number;

beforeAll(async () => {
  // Fetch the seeded course
  const courses = await db.execute<{ id: string }>(sql`
    SELECT id FROM courses WHERE slug = 'bordeaux-lac-test' LIMIT 1
  `);
  expect(courses[0]).toBeDefined();
  courseId = courses[0]!.id;

  // Fetch hole 1 details
  const holes = await db.execute<{
    id: string;
    distance_meters: number;
  }>(sql`
    SELECT id, distance_meters
    FROM holes
    WHERE course_id = ${courseId} AND hole_number = 1
    LIMIT 1
  `);
  expect(holes[0]).toBeDefined();
  hole1Id = holes[0]!.id;
  hole1DistanceMeters = holes[0]!.distance_meters;
});

// ── isOnCourse ─────────────────────────────────────────────────────

describe("isOnCourse", () => {
  it("returns the course when the point is inside the boundary", async () => {
    // Point near the seed course center
    const result = await isOnCourse(44.838, -0.579);

    expect(result).not.toBeNull();
    expect(result!.courseId).toBe(courseId);
    expect(result!.name).toBe("Golf de Bordeaux-Lac (Test)");
    expect(result!.slug).toBe("bordeaux-lac-test");
  });

  it("returns null when the point is far away (Paris)", async () => {
    const result = await isOnCourse(48.8566, 2.3522);

    expect(result).toBeNull();
  });
});

// ── detectHole ─────────────────────────────────────────────────────

describe("detectHole", () => {
  it("returns hole 1 when the point is at the hole 1 tee position", async () => {
    // Hole 1 tee: lat=44.8392, lng=-0.581
    const result = await detectHole(courseId, 44.8392, -0.581);

    expect(result).toBe(1);
  });

  it("returns null when the point is on-course but outside all hole geofences", async () => {
    // A point deliberately far from any hole geofence but still vaguely in the area.
    // The course boundary is ~800m around center (44.8378, -0.5792).
    // Using a point at the very edge of the course — unlikely to be inside any hole geofence.
    const result = await detectHole(courseId, 44.831, -0.572);

    expect(result).toBeNull();
  });
});

// ── distanceToGreen ────────────────────────────────────────────────

describe("distanceToGreen", () => {
  it("returns reasonable distances from hole 1 tee to the green", async () => {
    // Hole 1 tee: lat=44.8392, lng=-0.581
    const result = await distanceToGreen(hole1Id, 44.8392, -0.581);

    expect(result).not.toBeNull();

    // All distances should be positive and > 100m (hole 1 is 365m)
    expect(result!.front).toBeGreaterThan(100);
    expect(result!.center).toBeGreaterThan(100);
    expect(result!.back).toBeGreaterThan(100);

    // Center distance should be reasonably close to the hole's distanceMeters.
    // The seed computes green position with an offset, so we allow generous tolerance.
    // The distance should be in the same ballpark (within 50% of distanceMeters).
    expect(result!.center).toBeGreaterThan(hole1DistanceMeters * 0.5);
    expect(result!.center).toBeLessThan(hole1DistanceMeters * 1.5);

    // Front should be slightly less than center, back slightly more
    expect(result!.front).toBeLessThan(result!.back);
  });

  it("returns null for a non-existent hole ID", async () => {
    const result = await distanceToGreen("00000000-0000-0000-0000-000000000000", 44.8392, -0.581);

    expect(result).toBeNull();
  });
});
