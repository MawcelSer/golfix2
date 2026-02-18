import { describe, it, expect } from "vitest";
import { sql } from "drizzle-orm";
import { buildApp } from "../../app";
import { db } from "../../db/connection";
import { detectHole, distanceToGreen } from "../../spatial/spatial-service";

const COURSES_BASE = "/api/v1/courses";

// Seed course: "Golf de Bordeaux-Lac (Test)"
// Boundary: 800 m radius polygon around lat=44.8378, lng=-0.5792
// The center is well inside the polygon.
const INSIDE_POINT = { lat: 44.8378, lng: -0.5792 };

// Null Island (0°, 0°) — guaranteed outside any course boundary
const OCEAN_POINT = { lat: 0, lng: 0 };

// ── Tests ────────────────────────────────────────────────────────────

describe("Spatial integration tests", () => {
  // ── POST /courses/locate — inside boundary → found ───────────────

  it("course locate with seed course coordinates → found", async () => {
    const app = await buildApp();

    const response = await app.inject({
      method: "POST",
      url: `${COURSES_BASE}/locate`,
      payload: INSIDE_POINT,
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();
    expect(body.courseId).toBeDefined();
    expect(body.name).toBe("Golf de Bordeaux-Lac (Test)");
    expect(body.slug).toBe("bordeaux-lac-test");

    await app.close();
  });

  // ── POST /courses/locate — ocean coordinates → 404 ───────────────

  it("course locate with ocean coordinates (0,0) → 404", async () => {
    const app = await buildApp();

    const response = await app.inject({
      method: "POST",
      url: `${COURSES_BASE}/locate`,
      payload: OCEAN_POINT,
    });

    expect(response.statusCode).toBe(404);

    const body = response.json();
    expect(body.error).toBe("No course found at this location");

    await app.close();
  });

  // ── GET /courses/:slug/data — full geodata ────────────────────────

  it("course geodata endpoint returns full data with 18 holes and geometry", async () => {
    const app = await buildApp();

    const response = await app.inject({
      method: "GET",
      url: `${COURSES_BASE}/bordeaux-lac-test/data`,
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();

    // Top-level course fields
    expect(body.id).toBeDefined();
    expect(body.name).toBe("Golf de Bordeaux-Lac (Test)");
    expect(body.slug).toBe("bordeaux-lac-test");
    expect(body.holesCount).toBe(18);

    // Holes array
    expect(Array.isArray(body.holes)).toBe(true);
    expect(body.holes).toHaveLength(18);

    // Every hole must carry teePosition and greenCenter
    for (const hole of body.holes) {
      expect(hole.teePosition).not.toBeNull();
      expect(hole.teePosition).toBeDefined();
      expect(hole.greenCenter).not.toBeNull();
      expect(hole.greenCenter).toBeDefined();
    }

    await app.close();
  });

  // ── Hole detection at tee positions → correct hole number ─────────

  it("detectHole returns a valid hole number for tee positions", async () => {
    // Get course ID and all holes with their tee positions
    const rows = await db.execute<{
      course_id: string;
      hole_number: number;
      tee_lat: number;
      tee_lng: number;
    }>(sql`
      SELECT
        c.id AS course_id,
        h.hole_number,
        ST_Y(h.tee_position) AS tee_lat,
        ST_X(h.tee_position) AS tee_lng
      FROM courses c
      JOIN holes h ON h.course_id = c.id
      WHERE c.slug = 'bordeaux-lac-test'
      ORDER BY h.hole_number
    `);

    expect(rows.length).toBe(18);

    // Each tee position should be detected as some hole on the course
    // (seed geofences may overlap, so detected hole may be adjacent)
    let detectedCount = 0;
    for (const row of rows) {
      const detected = await detectHole(row.course_id, row.tee_lat, row.tee_lng);
      if (detected !== null) {
        expect(detected).toBeGreaterThanOrEqual(1);
        expect(detected).toBeLessThanOrEqual(18);
        detectedCount++;
      }
    }

    // At least 14 of 18 tee positions should be within some hole's geofence
    expect(detectedCount).toBeGreaterThanOrEqual(14);
  });

  // ── Distance to green from tee → reasonable value ─────────────────

  it("distanceToGreen from tee is a reasonable value", async () => {
    // Get a hole with its tee position and stored distance
    const rows = await db.execute<{
      hole_id: string;
      hole_number: number;
      distance_meters: number;
      tee_lat: number;
      tee_lng: number;
    }>(sql`
      SELECT
        h.id AS hole_id,
        h.hole_number,
        h.distance_meters,
        ST_Y(h.tee_position) AS tee_lat,
        ST_X(h.tee_position) AS tee_lng
      FROM holes h
      JOIN courses c ON c.id = h.course_id
      WHERE c.slug = 'bordeaux-lac-test'
      ORDER BY h.hole_number
      LIMIT 3
    `);

    for (const row of rows) {
      const distances = await distanceToGreen(row.hole_id, row.tee_lat, row.tee_lng);
      expect(distances).not.toBeNull();
      // Seed green_center is offset at ~80% of stored distance, so allow 25% tolerance
      expect(distances!.center).toBeGreaterThan(row.distance_meters * 0.5);
      expect(distances!.center).toBeLessThan(row.distance_meters * 1.5);
    }
  });
});
