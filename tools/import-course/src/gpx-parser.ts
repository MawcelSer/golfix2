import { XMLParser } from "fast-xml-parser";
import { z } from "zod";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ParsedCourse {
  tees: Map<number, { lat: number; lng: number }>;
  greens: Map<number, { lat: number; lng: number }>;
  hazards: Array<{ holeNumber: number; type: string; lat: number; lng: number }>;
}

// ── Validation ────────────────────────────────────────────────────────────────

const WptSchema = z.object({
  "@_lat": z.coerce.number(),
  "@_lon": z.coerce.number(),
  name: z.string(),
});

type Wpt = z.infer<typeof WptSchema>;

// ── Naming patterns ───────────────────────────────────────────────────────────

const TEE_RE = /^Tee_(\d{2})$/;
const GREEN_RE = /^Green_(\d{2})$/;
const HAZARD_RE = /^Hazard_(\d{2})_(\w+)$/;

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractWaypoints(gpxXml: string): Wpt[] {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
  const doc = parser.parse(gpxXml) as Record<string, unknown>;

  const gpx = doc["gpx"] as Record<string, unknown> | undefined;
  if (!gpx) return [];

  const raw = gpx["wpt"];
  if (!raw) return [];

  const items = Array.isArray(raw) ? raw : [raw];
  return items.map((item) => WptSchema.parse(item));
}

function classifyWaypoint(
  wpt: Wpt,
  tees: Map<number, { lat: number; lng: number }>,
  greens: Map<number, { lat: number; lng: number }>,
  hazards: Array<{ holeNumber: number; type: string; lat: number; lng: number }>,
): void {
  const { name } = wpt;
  const lat = wpt["@_lat"];
  const lng = wpt["@_lon"];

  const teeMatch = TEE_RE.exec(name);
  if (teeMatch?.[1]) {
    tees.set(parseInt(teeMatch[1], 10), { lat, lng });
    return;
  }

  const greenMatch = GREEN_RE.exec(name);
  if (greenMatch?.[1]) {
    greens.set(parseInt(greenMatch[1], 10), { lat, lng });
    return;
  }

  const hazardMatch = HAZARD_RE.exec(name);
  if (hazardMatch?.[1] && hazardMatch[2]) {
    hazards.push({ holeNumber: parseInt(hazardMatch[1], 10), type: hazardMatch[2], lat, lng });
  }
}

function validateTeesHaveGreens(tees: Map<number, unknown>, greens: Map<number, unknown>): void {
  for (const holeNumber of tees.keys()) {
    if (!greens.has(holeNumber)) {
      throw new Error(`Missing green for hole ${holeNumber}`);
    }
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export function parseGpx(gpxXml: string): ParsedCourse {
  const tees = new Map<number, { lat: number; lng: number }>();
  const greens = new Map<number, { lat: number; lng: number }>();
  const hazards: Array<{ holeNumber: number; type: string; lat: number; lng: number }> = [];

  const waypoints = extractWaypoints(gpxXml);
  for (const wpt of waypoints) {
    classifyWaypoint(wpt, tees, greens, hazards);
  }

  validateTeesHaveGreens(tees, greens);

  return { tees, greens, hazards };
}
