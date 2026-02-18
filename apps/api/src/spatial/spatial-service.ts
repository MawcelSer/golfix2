import { sql } from "drizzle-orm";
import { db } from "../db/connection";

// ── Types ──────────────────────────────────────────────────────────

export interface CourseMatch {
  courseId: string;
  name: string;
  slug: string;
}

export interface GreenDistances {
  front: number;
  center: number;
  back: number;
}

// ── isOnCourse ─────────────────────────────────────────────────────

/**
 * Determine whether a GPS point falls within any course boundary.
 *
 * @param lat  Latitude  (WGS-84)
 * @param lng  Longitude (WGS-84)
 * @returns    The matching course, or `null` if the point is off-course.
 */
export async function isOnCourse(lat: number, lng: number): Promise<CourseMatch | null> {
  const rows = await db.execute<{
    id: string;
    name: string;
    slug: string;
  }>(sql`
    SELECT id, name, slug
    FROM courses
    WHERE ST_Within(
      ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326),
      boundary
    )
    LIMIT 1
  `);

  const row = rows[0];
  if (!row) return null;

  return { courseId: row.id, name: row.name, slug: row.slug };
}

// ── detectHole ─────────────────────────────────────────────────────

/**
 * Detect which hole a golfer is currently on, based on geofence.
 *
 * @param courseId  UUID of the course
 * @param lat      Latitude  (WGS-84)
 * @param lng      Longitude (WGS-84)
 * @returns        The hole number (1-18), or `null` if outside all geofences.
 */
export async function detectHole(
  courseId: string,
  lat: number,
  lng: number,
): Promise<number | null> {
  const rows = await db.execute<{ hole_number: number }>(sql`
    SELECT hole_number
    FROM holes
    WHERE course_id = ${courseId}
      AND ST_Within(
        ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326),
        geofence
      )
    LIMIT 1
  `);

  const row = rows[0];
  if (!row) return null;

  return row.hole_number;
}

// ── distanceToGreen ────────────────────────────────────────────────

/**
 * Compute distances (in metres) from a GPS point to the green markers
 * of a given hole.
 *
 * Uses `geography` cast so PostGIS returns great-circle distance in metres.
 *
 * @param holeId  UUID of the hole
 * @param lat     Latitude  (WGS-84)
 * @param lng     Longitude (WGS-84)
 * @returns       `{ front, center, back }` distances, or `null` if the hole doesn't exist.
 */
export async function distanceToGreen(
  holeId: string,
  lat: number,
  lng: number,
): Promise<GreenDistances | null> {
  const rows = await db.execute<{
    front: string;
    center: string;
    back: string;
  }>(sql`
    SELECT
      ST_Distance(
        ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
        green_front::geography
      ) AS front,
      ST_Distance(
        ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
        green_center::geography
      ) AS center,
      ST_Distance(
        ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
        green_back::geography
      ) AS back
    FROM holes
    WHERE id = ${holeId}
  `);

  const row = rows[0];
  if (!row) return null;

  return {
    front: Number(row.front),
    center: Number(row.center),
    back: Number(row.back),
  };
}
