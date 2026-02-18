import { z } from "zod";

// ── Coordinate types ────────────────────────────────────────────────

export interface LatLng {
  readonly lat: number;
  readonly lng: number;
}

export interface Waypoint {
  readonly lat: number;
  readonly lng: number;
  readonly recordedAt: Date;
  readonly accuracy: number;
}

// ── Hole data (mirrors seed.ts) ─────────────────────────────────────

export interface HoleData {
  readonly num: number;
  readonly par: number;
  readonly si: number;
  readonly dist: number;
  readonly lat: number;
  readonly lng: number;
  readonly transition: number;
}

export interface ComputedHole extends HoleData {
  readonly greenLat: number;
  readonly greenLng: number;
  readonly targetMinutes: number;
}

// ── Scenario schemas ────────────────────────────────────────────────

export const stuckHoleSchema = z.object({
  hole: z.number().int().min(1).max(18),
  extraMinutes: z.number().positive(),
  reason: z.string(),
});

export const groupScenarioSchema = z.object({
  groupIndex: z.number().int().min(0),
  paceFactor: z.number().min(0.5).max(2.0),
  holeNoise: z.number().min(0).max(120).default(15),
  stuckHoles: z.array(stuckHoleSchema).default([]),
  dropOutAtHole: z.number().int().min(1).max(18).optional(),
});

export const scenarioDefinitionSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  groups: z.array(groupScenarioSchema).min(1).max(12),
});

export type StuckHole = z.infer<typeof stuckHoleSchema>;
export type GroupScenario = z.infer<typeof groupScenarioSchema>;
export type ScenarioDefinition = z.infer<typeof scenarioDefinitionSchema>;

// ── CLI options ─────────────────────────────────────────────────────

export interface SimulatorOptions {
  readonly scenario: string;
  readonly speed: number;
  readonly groups?: number;
  readonly seed?: number;
  readonly verbose: boolean;
  readonly dryRun: boolean;
  readonly apiUrl: string;
}

// ── Group state at runtime ──────────────────────────────────────────

export interface GroupState {
  readonly groupIndex: number;
  readonly scenario: GroupScenario;
  readonly currentHole: number;
  readonly holeStartTime: Date;
  readonly finished: boolean;
  readonly droppedOut: boolean;
  readonly sessionId?: string;
  readonly userId?: string;
  readonly token?: string;
}

// ── Position event ──────────────────────────────────────────────────

export interface PositionEvent {
  readonly sessionId: string;
  readonly lat: number;
  readonly lng: number;
  readonly accuracy: number;
  readonly recordedAt: Date;
  readonly hole: number;
  readonly groupIndex: number;
}
