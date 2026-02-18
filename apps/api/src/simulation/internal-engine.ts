import type { PositionEvent } from "./types";

const DEG_TO_RAD = Math.PI / 180;
const POSITION_INTERVAL_MS = 5000;

// ── Helpers ─────────────────────────────────────────────────────────

function metersToLatDeg(meters: number): number {
  return meters / 111_320;
}

function metersToLngDeg(meters: number, lat: number): number {
  return meters / (111_320 * Math.cos(lat * DEG_TO_RAD));
}

/** Simple mulberry32 PRNG */
function createRng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function gaussianNoise(rng: () => number, stdDev: number): number {
  const u1 = rng();
  const u2 = rng();
  return stdDev * Math.sqrt(-2 * Math.log(u1 || 0.0001)) * Math.cos(2 * Math.PI * u2);
}

// ── Hole data ───────────────────────────────────────────────────────

interface HoleData {
  num: number;
  par: number;
  dist: number;
  lat: number;
  lng: number;
  transition: number;
  greenLat: number;
  greenLng: number;
  targetMinutes: number;
}

function targetMinutesForPar(par: number): number {
  switch (par) {
    case 3: return 10;
    case 4: return 14;
    case 5: return 17;
    default: return 14;
  }
}

function computeHole(h: { num: number; par: number; dist: number; lat: number; lng: number; transition: number }): HoleData {
  const metersToLat = 1 / 111_320;
  return {
    ...h,
    greenLat: h.lat + h.dist * metersToLat * 0.8,
    greenLng: h.lng + 0.0003,
    targetMinutes: targetMinutesForPar(h.par),
  };
}

// ── Bezier path ─────────────────────────────────────────────────────

interface BezierPoint { lat: number; lng: number; }

function bezierPoint(p0: BezierPoint, p1: BezierPoint, p2: BezierPoint, t: number): BezierPoint {
  const mt = 1 - t;
  return {
    lat: mt * mt * p0.lat + 2 * mt * t * p1.lat + t * t * p2.lat,
    lng: mt * mt * p0.lng + 2 * mt * t * p1.lng + t * t * p2.lng,
  };
}

interface GroupConfig {
  groupIndex: number;
  paceFactor: number;
  holeNoise: number;
  stuckHoles: Array<{ hole: number; extraMinutes: number }>;
  dropOutAtHole?: number;
}

/** Generate all positions for a group's round */
function generateGroupPositions(
  holes: HoleData[],
  group: GroupConfig,
  startTime: Date,
  seed: number,
): PositionEvent[] {
  const rng = createRng(seed + group.groupIndex * 1000);
  const events: PositionEvent[] = [];
  let currentTime = startTime.getTime();
  const maxHole = group.dropOutAtHole ?? holes.length;

  for (let i = 0; i < maxHole; i++) {
    const hole = holes[i]!;
    const baseMs = hole.targetMinutes * 60_000 * group.paceFactor;
    const noise = gaussianNoise(rng, group.holeNoise * 1000);
    const stuck = group.stuckHoles.find((s) => s.hole === hole.num);
    const stuckMs = stuck ? stuck.extraMinutes * 60_000 : 0;
    const playTimeMs = Math.max(30_000, baseMs + noise + stuckMs);

    const waypointCount = Math.max(2, Math.ceil(playTimeMs / POSITION_INTERVAL_MS));
    const p0: BezierPoint = { lat: hole.lat, lng: hole.lng };
    const p2: BezierPoint = { lat: hole.greenLat, lng: hole.greenLng };
    const lateralOffset = (rng() - 0.5) * 40;
    const midLat = (p0.lat + p2.lat) / 2;
    const midLng = (p0.lng + p2.lng) / 2;
    const p1: BezierPoint = {
      lat: midLat + metersToLatDeg(lateralOffset),
      lng: midLng + metersToLngDeg(lateralOffset * 0.5, midLat),
    };

    for (let w = 0; w < waypointCount; w++) {
      const t = w / (waypointCount - 1);
      const point = bezierPoint(p0, p1, p2, t);
      const noiseM = 5 + rng() * 10;

      events.push({
        sessionId: `sim-session-${group.groupIndex}`,
        lat: point.lat + gaussianNoise(rng, metersToLatDeg(noiseM)),
        lng: point.lng + gaussianNoise(rng, metersToLngDeg(noiseM, point.lat)),
        accuracy: 5 + rng() * 10,
        recordedAt: new Date(currentTime + (playTimeMs * w) / (waypointCount - 1)),
        hole: hole.num,
        groupIndex: group.groupIndex,
      });
    }

    currentTime += playTimeMs + hole.transition * 60_000;
  }

  return events;
}

// ── Internal simulation runner ──────────────────────────────────────

export type PositionCallback = (event: PositionEvent) => void;

export interface InternalSimOptions {
  speed: number;
  groupCount: number;
  seed?: number;
  holesData: Array<{ num: number; par: number; dist: number; lat: number; lng: number; transition: number }>;
}

/**
 * Run the simulation internally, calling onPosition for each GPS event.
 * Uses a virtual clock — at speed=30, a 4h15 round plays in ~8.5 minutes.
 */
export async function runInternalSimulation(
  options: InternalSimOptions,
  onPosition: PositionCallback,
  signal?: AbortSignal,
): Promise<void> {
  const holes = options.holesData.map(computeHole);
  const startTime = new Date();
  startTime.setHours(8, 0, 0, 0);

  const seed = options.seed ?? Date.now();
  const teeIntervalMs = 8 * 60_000;

  // Generate groups with moderate variation
  const rng = createRng(seed);
  const groups: GroupConfig[] = Array.from({ length: options.groupCount }, (_, i) => ({
    groupIndex: i,
    paceFactor: 0.9 + rng() * 0.3, // 0.9 - 1.2
    holeNoise: 10 + rng() * 10,
    stuckHoles: rng() < 0.25
      ? [{ hole: 1 + Math.floor(rng() * 18), extraMinutes: 2 + Math.floor(rng() * 5) }]
      : [],
  }));

  // Generate and flatten all events
  const allEvents: PositionEvent[] = [];
  for (const group of groups) {
    const groupStart = new Date(startTime.getTime() + group.groupIndex * teeIntervalMs);
    const events = generateGroupPositions(holes, group, groupStart, seed);
    allEvents.push(...events);
  }
  allEvents.sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime());

  // Replay at speed
  const realStart = Date.now();
  const simStart = allEvents[0]?.recordedAt.getTime() ?? startTime.getTime();

  for (const event of allEvents) {
    if (signal?.aborted) break;

    const simOffset = event.recordedAt.getTime() - simStart;
    const realTarget = realStart + simOffset / options.speed;
    const waitMs = realTarget - Date.now();

    if (waitMs > 0) {
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, waitMs);
        signal?.addEventListener("abort", () => {
          clearTimeout(timer);
          resolve();
        }, { once: true });
      });
    }

    if (signal?.aborted) break;
    onPosition(event);
  }
}
