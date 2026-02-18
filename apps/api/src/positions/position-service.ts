import { eq, and } from "drizzle-orm";
import { db } from "../db/connection";
import { sessions, positions } from "../db/schema/index";

// ── Error class ─────────────────────────────────────────────────────

export class PositionError extends Error {
  public readonly statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = "PositionError";
    this.statusCode = statusCode;
  }
}

// ── Types ───────────────────────────────────────────────────────────

interface PositionData {
  lat: number;
  lng: number;
  accuracy: number;
  recordedAt: string;
}

// ── batchInsertPositions ────────────────────────────────────────────

export async function batchInsertPositions(
  sessionId: string,
  userId: string,
  positionsData: PositionData[],
): Promise<number> {
  // Verify session ownership and active status
  const rows = await db
    .select({ id: sessions.id, courseId: sessions.courseId })
    .from(sessions)
    .where(
      and(eq(sessions.id, sessionId), eq(sessions.userId, userId), eq(sessions.status, "active")),
    )
    .limit(1);

  if (rows.length === 0) {
    throw new PositionError("Session not found or not active", 404);
  }

  // Deduplicate by recordedAt within the batch (session_id is constant)
  const seen = new Set<string>();
  const unique = positionsData.filter((p) => {
    if (seen.has(p.recordedAt)) return false;
    seen.add(p.recordedAt);
    return true;
  });

  if (unique.length === 0) return 0;

  // Bulk insert positions
  await db.insert(positions).values(
    unique.map((p) => ({
      sessionId,
      location: { x: p.lng, y: p.lat },
      accuracy: p.accuracy,
      recordedAt: new Date(p.recordedAt),
    })),
  );

  return unique.length;
}
