import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index";

const connectionString =
  process.env.DATABASE_URL ?? "postgresql://golfix:golfix_dev@localhost:5433/golfix";

const client = postgres(connectionString, { max: 1 });
const db = drizzle(client, { schema });

// ── Helpers ────────────────────────────────────────────────────────

/** Create a PostGIS polygon SQL expression around a point */
function polygonSql(lat: number, lng: number, radiusMeters: number) {
  const latOff = radiusMeters / 111_320;
  const lngOff = radiusMeters / (111_320 * Math.cos((lat * Math.PI) / 180));
  const coords = [
    [lng - lngOff, lat - latOff],
    [lng + lngOff, lat - latOff],
    [lng + lngOff, lat + latOff],
    [lng - lngOff, lat + latOff],
    [lng - lngOff, lat - latOff],
  ];
  const wkt = `SRID=4326;POLYGON((${coords.map((c) => c.join(" ")).join(", ")}))`;
  return sql`ST_GeomFromEWKT(${wkt})`;
}

/** Point as { x, y } for Drizzle xy mode (x=lng, y=lat) */
function point(lat: number, lng: number) {
  return { x: lng, y: lat };
}

// ── Seed Data ──────────────────────────────────────────────────────

const COURSE_CENTER = { lat: 44.8378, lng: -0.5792 };

const HOLES_DATA = [
  { num: 1, par: 4, si: 7, dist: 365, lat: 44.8392, lng: -0.581, transition: 1 },
  { num: 2, par: 3, si: 15, dist: 155, lat: 44.84, lng: -0.5798, transition: 1 },
  { num: 3, par: 5, si: 1, dist: 510, lat: 44.841, lng: -0.5785, transition: 2 },
  { num: 4, par: 4, si: 9, dist: 380, lat: 44.8405, lng: -0.577, transition: 1 },
  { num: 5, par: 4, si: 3, dist: 410, lat: 44.8395, lng: -0.5758, transition: 1 },
  { num: 6, par: 3, si: 17, dist: 140, lat: 44.8385, lng: -0.5748, transition: 2 },
  { num: 7, par: 5, si: 5, dist: 490, lat: 44.8375, lng: -0.576, transition: 3 },
  { num: 8, par: 4, si: 11, dist: 340, lat: 44.8365, lng: -0.5775, transition: 1 },
  { num: 9, par: 4, si: 13, dist: 355, lat: 44.8358, lng: -0.579, transition: 2 },
  { num: 10, par: 4, si: 8, dist: 375, lat: 44.837, lng: -0.581, transition: 1 },
  { num: 11, par: 3, si: 16, dist: 165, lat: 44.838, lng: -0.5825, transition: 1 },
  { num: 12, par: 5, si: 2, dist: 520, lat: 44.839, lng: -0.5838, transition: 2 },
  { num: 13, par: 4, si: 10, dist: 350, lat: 44.84, lng: -0.582, transition: 1 },
  { num: 14, par: 4, si: 4, dist: 395, lat: 44.8408, lng: -0.5805, transition: 1 },
  { num: 15, par: 3, si: 18, dist: 130, lat: 44.8398, lng: -0.579, transition: 1 },
  { num: 16, par: 5, si: 6, dist: 505, lat: 44.8388, lng: -0.5778, transition: 2 },
  { num: 17, par: 4, si: 12, dist: 360, lat: 44.8378, lng: -0.5795, transition: 1 },
  { num: 18, par: 4, si: 14, dist: 370, lat: 44.8368, lng: -0.5808, transition: 1 },
] as const;

async function seed() {
  console.log("Seeding database...");

  // ── Course ───────────────────────────────────────────────────────

  const [course] = await db
    .insert(schema.courses)
    .values({
      name: "Golf de Bordeaux-Lac (Test)",
      slug: "bordeaux-lac-test",
      boundary: polygonSql(COURSE_CENTER.lat, COURSE_CENTER.lng, 800),
      holesCount: 18,
      par: 72,
      paceTargetMinutes: 255,
      teeIntervalMinutes: 8,
      timezone: "Europe/Paris",
      address: "Avenue de Pernon",
      city: "Bordeaux",
      country: "FR",
    })
    .returning({ id: schema.courses.id, name: schema.courses.name });

  console.log(`  Course: ${course!.name} (${course!.id})`);

  // ── Holes + Hazards ──────────────────────────────────────────────

  for (const h of HOLES_DATA) {
    const metersToLat = 1 / 111_320;
    const greenLat = h.lat + h.dist * metersToLat * 0.8;
    const greenLng = h.lng + 0.0003;

    const [hole] = await db
      .insert(schema.holes)
      .values({
        courseId: course!.id,
        holeNumber: h.num,
        par: h.par,
        strokeIndex: h.si,
        distanceMeters: h.dist,
        geofence: polygonSql(
          (h.lat + greenLat) / 2,
          (h.lng + greenLng) / 2,
          Math.max(h.dist * 0.6, 100),
        ),
        teePosition: point(h.lat, h.lng),
        greenCenter: point(greenLat, greenLng),
        greenFront: point(greenLat - 0.00012, greenLng),
        greenBack: point(greenLat + 0.00012, greenLng),
        transitionMinutes: h.transition,
      })
      .returning({ id: schema.holes.id });

    if (h.par >= 4) {
      const hazardLat = (h.lat + greenLat) / 2 + 0.0003;
      const hazardLng = h.lng + 0.0008;
      const hazardType = h.num % 3 === 0 ? "water" : h.num % 3 === 1 ? "bunker" : "lateral";

      await db.insert(schema.hazards).values({
        holeId: hole!.id,
        type: hazardType as "bunker" | "water" | "lateral",
        name: hazardType === "water" ? `Lac du ${h.num}` : `Bunker ${h.num}`,
        geometry: polygonSql(hazardLat, hazardLng, 20),
        carryPoint: point(hazardLat, hazardLng),
      });
    }
  }

  console.log("  18 holes + hazards created");

  // ── Manager user ─────────────────────────────────────────────────

  const [manager] = await db
    .insert(schema.users)
    .values({
      email: "manager@golfix.test",
      displayName: "Test Manager",
      passwordHash: "$2b$12$placeholder.hash.for.seeding.only.not.real",
    })
    .returning();

  await db.insert(schema.courseRoles).values({
    userId: manager!.id,
    courseId: course!.id,
    role: "owner",
  });

  console.log(`  Manager: ${manager!.email} (owner)`);

  // ── Sample golfers ───────────────────────────────────────────────

  const golfers = await db
    .insert(schema.users)
    .values([
      { displayName: "Alice Dupont", deviceId: "device-alice-001", handicapIndex: "18.5" },
      { displayName: "Bob Martin", deviceId: "device-bob-002", handicapIndex: "12.3" },
      { displayName: "Claire Petit", deviceId: "device-claire-003", handicapIndex: "24.0" },
      { displayName: "David Moreau", deviceId: "device-david-004", handicapIndex: "8.7" },
    ])
    .returning();

  console.log(`  ${golfers.length} golfers created`);

  // ── Tee times (today) ────────────────────────────────────────────

  const today = new Date();
  today.setHours(8, 0, 0, 0);

  const teeTimeValues = Array.from({ length: 8 }, (_, i) => ({
    courseId: course!.id,
    scheduledAt: new Date(today.getTime() + i * 8 * 60_000),
    playersCount: 4 as const,
  }));

  const teeTimes = await db.insert(schema.teeTimes).values(teeTimeValues).returning();

  console.log(`  ${teeTimes.length} tee times created (8:00 - 8:56)`);

  // ── Done ─────────────────────────────────────────────────────────

  console.log("\nSeed complete!");
  await client.end();
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
