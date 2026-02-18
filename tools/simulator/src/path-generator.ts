import type { ComputedHole, Waypoint } from "./types";

const EARTH_RADIUS_M = 6_371_000;
const DEG_TO_RAD = Math.PI / 180;

// ── Haversine helpers ───────────────────────────────────────────────

/** Convert meters to approximate latitude degrees */
function metersToLatDeg(meters: number): number {
  return meters / 111_320;
}

/** Convert meters to approximate longitude degrees at a given latitude */
function metersToLngDeg(meters: number, lat: number): number {
  return meters / (111_320 * Math.cos(lat * DEG_TO_RAD));
}

/** Haversine distance in meters between two lat/lng points */
export function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = (lat2 - lat1) * DEG_TO_RAD;
  const dLng = (lng2 - lng1) * DEG_TO_RAD;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * DEG_TO_RAD) * Math.cos(lat2 * DEG_TO_RAD) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Seeded PRNG ─────────────────────────────────────────────────────

/** Simple mulberry32 PRNG for reproducible noise */
export function createRng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** Gaussian noise via Box-Muller transform */
export function gaussianNoise(rng: () => number, stdDev: number): number {
  const u1 = rng();
  const u2 = rng();
  return stdDev * Math.sqrt(-2 * Math.log(u1 || 0.0001)) * Math.cos(2 * Math.PI * u2);
}

// ── Quadratic Bezier path ───────────────────────────────────────────

interface BezierPoint {
  lat: number;
  lng: number;
}

/** Evaluate quadratic Bezier at parameter t (0..1) */
function bezierPoint(p0: BezierPoint, p1: BezierPoint, p2: BezierPoint, t: number): BezierPoint {
  const mt = 1 - t;
  return {
    lat: mt * mt * p0.lat + 2 * mt * t * p1.lat + t * t * p2.lat,
    lng: mt * mt * p0.lng + 2 * mt * t * p1.lng + t * t * p2.lng,
  };
}

/**
 * Generate GPS waypoints along a hole from tee to green.
 *
 * Uses a quadratic Bezier curve with a lateral offset control point
 * to simulate a realistic golf ball flight path. Adds GPS noise.
 *
 * @param hole - Hole data with tee and green positions
 * @param playTimeMs - Total play time for this hole in milliseconds
 * @param startTime - Simulated start time for this hole
 * @param intervalMs - Interval between waypoints (default 5000ms = 5s)
 * @param rng - Random number generator for noise
 */
export function generateHoleWaypoints(
  hole: ComputedHole,
  playTimeMs: number,
  startTime: Date,
  intervalMs: number = 5000,
  rng: () => number = Math.random,
): Waypoint[] {
  const waypointCount = Math.max(2, Math.ceil(playTimeMs / intervalMs));

  // Tee and green positions
  const p0: BezierPoint = { lat: hole.lat, lng: hole.lng };
  const p2: BezierPoint = { lat: hole.greenLat, lng: hole.greenLng };

  // Control point: midpoint with lateral offset (±20m)
  const midLat = (p0.lat + p2.lat) / 2;
  const midLng = (p0.lng + p2.lng) / 2;
  const lateralOffset = (rng() - 0.5) * 2 * 20; // ±20m
  const p1: BezierPoint = {
    lat: midLat + metersToLatDeg(lateralOffset),
    lng: midLng + metersToLngDeg(lateralOffset * 0.5, midLat),
  };

  const waypoints: Waypoint[] = [];

  for (let i = 0; i < waypointCount; i++) {
    const t = i / (waypointCount - 1);
    const point = bezierPoint(p0, p1, p2, t);

    // GPS noise: ±5-15m accuracy
    const noiseM = 5 + rng() * 10;
    const noiseLat = gaussianNoise(rng, metersToLatDeg(noiseM));
    const noiseLng = gaussianNoise(rng, metersToLngDeg(noiseM, point.lat));

    const accuracy = 5 + rng() * 10; // reported accuracy in meters

    waypoints.push({
      lat: point.lat + noiseLat,
      lng: point.lng + noiseLng,
      recordedAt: new Date(startTime.getTime() + (playTimeMs * i) / (waypointCount - 1)),
      accuracy,
    });
  }

  return waypoints;
}

/**
 * Compute target play time per hole based on par and course pace target.
 *
 * Distribution: par 3 → 10min, par 4 → 14min, par 5 → 17min
 * Total for 72 par = 255min (4h15)
 */
export function targetMinutesForPar(par: number): number {
  switch (par) {
    case 3:
      return 10;
    case 4:
      return 14;
    case 5:
      return 17;
    default:
      return 14;
  }
}

/** Enrich raw hole data with computed green position and target time */
export function computeHole(hole: {
  num: number;
  par: number;
  si: number;
  dist: number;
  lat: number;
  lng: number;
  transition: number;
}): ComputedHole {
  const metersToLat = 1 / 111_320;
  const greenLat = hole.lat + hole.dist * metersToLat * 0.8;
  const greenLng = hole.lng + 0.0003;

  return {
    ...hole,
    greenLat,
    greenLng,
    targetMinutes: targetMinutesForPar(hole.par),
  };
}
