import { PaceEngine, type PaceEngineConfig } from "./pace-engine";
import type { HoleData } from "./pace-types";

// ── Types ───────────────────────────────────────────────────────────

interface PositionEntry {
  sessionId: string;
  lat: number;
  lng: number;
  holeNumber: number | null;
  recordedAt: Date;
}

interface EngineEntry {
  engine: PaceEngine;
  positions: Map<string, PositionEntry>;
  holeDetections: Map<string, number | null>;
  lastActivity: Date;
}

// ── PaceEngineManager ───────────────────────────────────────────────

export class PaceEngineManager {
  private engines = new Map<string, EngineEntry>();

  getOrCreate(courseId: string, holes: HoleData[]): EngineEntry {
    let entry = this.engines.get(courseId);
    if (!entry) {
      const config: PaceEngineConfig = { courseId, holes };
      entry = {
        engine: new PaceEngine(config),
        positions: new Map(),
        holeDetections: new Map(),
        lastActivity: new Date(),
      };
      this.engines.set(courseId, entry);
    }
    return entry;
  }

  feedPosition(
    courseId: string,
    sessionId: string,
    lat: number,
    lng: number,
    holeNumber: number | null,
    recordedAt: Date,
  ): void {
    const entry = this.engines.get(courseId);
    if (!entry) return;

    entry.positions.set(sessionId, { sessionId, lat, lng, holeNumber, recordedAt });
    entry.holeDetections.set(sessionId, holeNumber);
    entry.lastActivity = new Date();
  }

  getActiveEngines(): Map<string, EngineEntry> {
    return this.engines;
  }

  getEngine(courseId: string): EngineEntry | undefined {
    return this.engines.get(courseId);
  }

  remove(courseId: string): void {
    this.engines.delete(courseId);
  }

  clear(): void {
    this.engines.clear();
  }
}
