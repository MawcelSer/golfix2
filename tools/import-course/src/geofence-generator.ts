// ── Constants ─────────────────────────────────────────────────────────────────

const EARTH_RADIUS_M = 6_371_000;
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
const MIN_BUFFER_M = 100;

// ── Coordinate type ───────────────────────────────────────────────────────────

interface LatLng {
  lat: number;
  lng: number;
}

// ── Distance ──────────────────────────────────────────────────────────────────

export function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = (lat2 - lat1) * DEG_TO_RAD;
  const dLng = (lng2 - lng1) * DEG_TO_RAD;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * DEG_TO_RAD) * Math.cos(lat2 * DEG_TO_RAD) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Bearing ───────────────────────────────────────────────────────────────────

function bearing(from: LatLng, to: LatLng): number {
  const dLng = (to.lng - from.lng) * DEG_TO_RAD;
  const lat1 = from.lat * DEG_TO_RAD;
  const lat2 = to.lat * DEG_TO_RAD;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return Math.atan2(y, x); // radians
}

// ── Destination point given distance + bearing ────────────────────────────────

function destination(origin: LatLng, distanceM: number, bearingRad: number): LatLng {
  const lat1 = origin.lat * DEG_TO_RAD;
  const lng1 = origin.lng * DEG_TO_RAD;
  const angDist = distanceM / EARTH_RADIUS_M;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angDist) + Math.cos(lat1) * Math.sin(angDist) * Math.cos(bearingRad),
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(bearingRad) * Math.sin(angDist) * Math.cos(lat1),
      Math.cos(angDist) - Math.sin(lat1) * Math.sin(lat2),
    );

  return { lat: lat2 * RAD_TO_DEG, lng: lng2 * RAD_TO_DEG };
}

// ── EWKT formatter ────────────────────────────────────────────────────────────

function toEwkt(corners: LatLng[]): string {
  const ring = [...corners, corners[0]]; // close the ring
  const coords = ring.map((p) => `${p!.lng} ${p!.lat}`).join(", ");
  return `SRID=4326;POLYGON((${coords}))`;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Generate a buffered rectangular geofence around the tee-to-green axis.
 *
 * Buffer = max(distance * 0.6, 100) metres applied:
 *   - perpendicular (±) to the fairway centreline
 *   - beyond the tee and beyond the green along the centreline
 *
 * Returns an EWKT string: SRID=4326;POLYGON((...)) with a 5-point closed ring.
 */
export function generateGeofence(tee: LatLng, green: LatLng): string {
  const dist = haversineDistance(tee.lat, tee.lng, green.lat, green.lng);
  const buffer = Math.max(dist * 0.6, MIN_BUFFER_M);

  const fwdBearing = bearing(tee, green); // tee → green
  const revBearing = fwdBearing + Math.PI; // green → tee
  const leftBearing = fwdBearing - Math.PI / 2;
  const rightBearing = fwdBearing + Math.PI / 2;

  // Extend centreline beyond tee and green by buffer metres
  const backCenter = destination(tee, buffer, revBearing);
  const frontCenter = destination(green, buffer, fwdBearing);

  // Four corners of the rectangle
  const backLeft = destination(backCenter, buffer, leftBearing);
  const backRight = destination(backCenter, buffer, rightBearing);
  const frontRight = destination(frontCenter, buffer, rightBearing);
  const frontLeft = destination(frontCenter, buffer, leftBearing);

  return toEwkt([backLeft, backRight, frontRight, frontLeft]);
}

/**
 * Compute the course boundary as a bounding-box EWKT polygon
 * from all tee and green coordinates.
 */
export function computeCourseBoundary(points: LatLng[]): string {
  if (points.length === 0) {
    throw new Error("Cannot compute boundary: no points provided");
  }

  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);

  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  // Add a small margin (~50m ≈ 0.00045°)
  const margin = 0.00045;
  const corners: LatLng[] = [
    { lat: minLat - margin, lng: minLng - margin },
    { lat: minLat - margin, lng: maxLng + margin },
    { lat: maxLat + margin, lng: maxLng + margin },
    { lat: maxLat + margin, lng: minLng - margin },
  ];

  return toEwkt(corners);
}
