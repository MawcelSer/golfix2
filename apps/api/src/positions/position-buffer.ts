import { db } from "../db/connection";
import { positions } from "../db/schema/index";

// ── Types ─────────────────────────────────────────────────────────

export interface PositionInput {
  sessionId: string;
  lat: number;
  lng: number;
  accuracy: number;
  recordedAt: Date;
}

export interface PositionBuffer {
  add(position: PositionInput): void;
  flush(): Promise<number>;
  size(): number;
  start(): void;
  stop(): Promise<void>;
}

// ── InMemoryPositionBuffer ────────────────────────────────────────

export class InMemoryPositionBuffer implements PositionBuffer {
  private buffer: Map<string, PositionInput[]> = new Map();
  private intervalId: ReturnType<typeof setInterval> | null = null;

  add(position: PositionInput): void {
    const existing = this.buffer.get(position.sessionId);
    if (existing) {
      existing.push(position);
    } else {
      this.buffer.set(position.sessionId, [position]);
    }
  }

  async flush(): Promise<number> {
    const allPositions: PositionInput[] = [];
    for (const entries of this.buffer.values()) {
      allPositions.push(...entries);
    }
    this.buffer.clear();

    if (allPositions.length === 0) {
      return 0;
    }

    await db.insert(positions).values(
      allPositions.map((p) => ({
        sessionId: p.sessionId,
        location: { x: p.lng, y: p.lat },
        accuracy: p.accuracy,
        recordedAt: p.recordedAt,
      })),
    );

    return allPositions.length;
  }

  size(): number {
    let total = 0;
    for (const entries of this.buffer.values()) {
      total += entries.length;
    }
    return total;
  }

  start(): void {
    if (this.intervalId !== null) {
      return;
    }
    this.intervalId = setInterval(() => {
      void this.flush();
    }, 2000);
  }

  async stop(): Promise<void> {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    await this.flush();
  }
}

// ── Singleton ─────────────────────────────────────────────────────

export const positionBuffer = new InMemoryPositionBuffer();
