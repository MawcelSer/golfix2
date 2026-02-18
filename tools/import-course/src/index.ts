import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Command } from "commander";
import postgres, { type Sql } from "postgres";
import { parseGpx } from "./gpx-parser.js";
import { generateGeofence, computeCourseBoundary, haversineDistance } from "./geofence-generator.js";

// ── CLI definition ────────────────────────────────────────────────────────────

const program = new Command();

program
  .name("import-course")
  .description("Import a GPX waypoint file as a golf course into the database")
  .requiredOption("--gpx <path>", "Path to the GPX file")
  .requiredOption("--name <name>", "Course name")
  .requiredOption("--slug <slug>", "URL-friendly course slug")
  .option("--par <number>", "Total course par (computed from holes if omitted)")
  .option("--pace-target <minutes>", "Pace target in minutes", "240")
  .action(run);

program.parse(process.argv);

// ── Types ─────────────────────────────────────────────────────────────────────

interface HoleRow {
  id: string;
  holeNumber: number;
  par: number;
  strokeIndex: number;
  distanceMeters: number;
  geofenceEwkt: string;
  teeLng: number;
  teeLat: number;
  greenLng: number;
  greenLat: number;
}

// ── Default par per hole ──────────────────────────────────────────────────────

function defaultParForDistance(distanceM: number): number {
  if (distanceM < 230) return 3;
  if (distanceM < 430) return 4;
  return 5;
}

// ── DB insertion helpers ──────────────────────────────────────────────────────

async function insertCourse(
  sql: Sql,
  courseId: string,
  name: string,
  slug: string,
  boundaryEwkt: string,
  holesCount: number,
  par: number,
  paceTargetMinutes: number,
): Promise<void> {
  await sql`
    INSERT INTO courses (id, name, slug, boundary, holes_count, par, pace_target_minutes)
    VALUES (
      ${courseId},
      ${name},
      ${slug},
      ST_GeomFromEWKT(${boundaryEwkt}),
      ${holesCount},
      ${par},
      ${paceTargetMinutes}
    )
  `;
}

async function insertHole(sql: Sql, hole: HoleRow, courseId: string): Promise<void> {
  await sql`
    INSERT INTO holes (
      id, course_id, hole_number, par, stroke_index, distance_meters,
      geofence, tee_position, green_center
    ) VALUES (
      ${hole.id},
      ${courseId},
      ${hole.holeNumber},
      ${hole.par},
      ${hole.strokeIndex},
      ${hole.distanceMeters},
      ST_GeomFromEWKT(${hole.geofenceEwkt}),
      ST_SetSRID(ST_MakePoint(${hole.teeLng}, ${hole.teeLat}), 4326),
      ST_SetSRID(ST_MakePoint(${hole.greenLng}, ${hole.greenLat}), 4326)
    )
  `;
}

async function insertHazard(
  sql: Sql,
  holeId: string,
  type: string,
  lat: number,
  lng: number,
): Promise<void> {
  const hazardEwkt = buildPointPolygonEwkt(lat, lng);
  await sql`
    INSERT INTO hazards (id, hole_id, type, geometry, carry_point)
    VALUES (
      ${crypto.randomUUID()},
      ${holeId},
      ${type},
      ST_GeomFromEWKT(${hazardEwkt}),
      ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)
    )
  `;
}

// ── Main action ───────────────────────────────────────────────────────────────

async function run(opts: {
  gpx: string;
  name: string;
  slug: string;
  par?: string;
  paceTarget: string;
}): Promise<void> {
  const dbUrl = process.env["DATABASE_URL"];
  if (!dbUrl) {
    console.error("ERROR: DATABASE_URL environment variable is not set.");
    process.exit(1);
  }

  // ── Parse GPX ──────────────────────────────────────────────────────────────
  const gpxPath = resolve(opts.gpx);
  const gpxXml = readFileSync(gpxPath, "utf8");
  const parsed = parseGpx(gpxXml);

  const holeNumbers = [...parsed.tees.keys()].sort((a, b) => a - b);

  if (holeNumbers.length === 0) {
    console.error("ERROR: No holes found in GPX file.");
    process.exit(1);
  }

  // ── Build hole rows ────────────────────────────────────────────────────────
  const holeRows: HoleRow[] = holeNumbers.map((n, idx) => {
    const tee = parsed.tees.get(n)!;
    const green = parsed.greens.get(n)!;
    const dist = Math.round(haversineDistance(tee.lat, tee.lng, green.lat, green.lng));
    const holePar = defaultParForDistance(dist);
    const geofenceEwkt = generateGeofence(tee, green);

    return {
      id: crypto.randomUUID(),
      holeNumber: n,
      par: holePar,
      strokeIndex: idx + 1, // placeholder: 1-based order
      distanceMeters: dist,
      geofenceEwkt,
      teeLng: tee.lng,
      teeLat: tee.lat,
      greenLng: green.lng,
      greenLat: green.lat,
    };
  });

  // ── Course-level data ──────────────────────────────────────────────────────
  const totalPar = opts.par
    ? parseInt(opts.par, 10)
    : holeRows.reduce((sum, h) => sum + h.par, 0);

  const paceTargetMinutes = parseInt(opts.paceTarget, 10);

  const allPoints = holeNumbers.flatMap((n) => [parsed.tees.get(n)!, parsed.greens.get(n)!]);
  const boundaryEwkt = computeCourseBoundary(allPoints);
  const courseId = crypto.randomUUID();

  // ── Insert into DB ─────────────────────────────────────────────────────────
  const sql = postgres(dbUrl);
  try {
    await sql.unsafe("BEGIN");
    try {
      await insertCourse(
        sql,
        courseId,
        opts.name,
        opts.slug,
        boundaryEwkt,
        holeRows.length,
        totalPar,
        paceTargetMinutes,
      );

      for (const hole of holeRows) {
        await insertHole(sql, hole, courseId);
      }

      const holeIdMap = new Map(holeRows.map((h) => [h.holeNumber, h.id]));
      for (const hazard of parsed.hazards) {
        const holeId = holeIdMap.get(hazard.holeNumber);
        if (!holeId) continue;
        await insertHazard(sql, holeId, hazard.type, hazard.lat, hazard.lng);
      }

      await sql.unsafe("COMMIT");
    } catch (err) {
      await sql.unsafe("ROLLBACK");
      throw err;
    }
  } finally {
    await sql.end();
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log("\nImport successful!");
  console.log(`  Course : ${opts.name} (${opts.slug})`);
  console.log(`  ID     : ${courseId}`);
  console.log(`  Holes  : ${holeRows.length}`);
  console.log(`  Par    : ${totalPar}`);
  console.log(`  Hazards: ${parsed.hazards.length}`);
  console.log(`  Pace   : ${paceTargetMinutes} min\n`);
}

// ── Utility ───────────────────────────────────────────────────────────────────

/**
 * Build a tiny square polygon (approximately 1m side) centred on a point.
 * Used for hazard waypoints that don't have a polygon geometry.
 */
function buildPointPolygonEwkt(lat: number, lng: number): string {
  const d = 0.000009; // approximately 1m in degrees
  return (
    `SRID=4326;POLYGON((` +
    `${lng - d} ${lat - d}, ` +
    `${lng + d} ${lat - d}, ` +
    `${lng + d} ${lat + d}, ` +
    `${lng - d} ${lat + d}, ` +
    `${lng - d} ${lat - d}` +
    `))`
  );
}
