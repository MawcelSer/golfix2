import { z } from "zod";
import type { Server, Socket } from "socket.io";
import { eq, and } from "drizzle-orm";
import { db } from "../db/connection";
import { sessions } from "../db/schema/index";
import { positionBuffer } from "../positions/position-buffer";
import { detectHole } from "../spatial/spatial-service";

// ── Validation schema ──────────────────────────────────────────────

export const positionUpdateSchema = z.object({
  sessionId: z.string().uuid(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy: z.number().positive(),
  recordedAt: z.string().datetime(),
});

export type PositionUpdate = z.infer<typeof positionUpdateSchema>;

// ── Session verification ───────────────────────────────────────────

async function verifySession(
  sessionId: string,
  userId: string,
): Promise<{ courseId: string } | null> {
  const rows = await db
    .select({ courseId: sessions.courseId })
    .from(sessions)
    .where(
      and(eq(sessions.id, sessionId), eq(sessions.userId, userId), eq(sessions.status, "active")),
    )
    .limit(1);

  return rows[0] ?? null;
}

// ── Handler ────────────────────────────────────────────────────────

export function registerPositionHandler(io: Server, socket: Socket): void {
  socket.on("position:update", async (data: unknown) => {
    // 1. Validate with Zod
    const result = positionUpdateSchema.safeParse(data);
    if (!result.success) {
      socket.emit("error", {
        message: `Invalid position data: ${result.error.issues[0]?.message ?? "validation failed"}`,
      });
      return;
    }

    const { sessionId, lat, lng, accuracy, recordedAt } = result.data;
    const userId = socket.data.userId;

    // 2. Verify session belongs to this user
    let session: { courseId: string } | null;
    try {
      session = await verifySession(sessionId, userId);
    } catch {
      socket.emit("error", { message: "Failed to verify session" });
      return;
    }

    if (!session) {
      socket.emit("error", { message: "Session not found or not active" });
      return;
    }

    const { courseId } = session;

    // 3. Add to PositionBuffer
    positionBuffer.add({
      sessionId,
      lat,
      lng,
      accuracy,
      recordedAt: new Date(recordedAt),
    });

    // 4. Optionally detect hole via spatial service
    let holeNumber: number | null = null;
    try {
      holeNumber = await detectHole(courseId, lat, lng);
    } catch {
      // Non-critical — continue without hole detection
    }

    // 5. Emit to dashboard room
    io.to(`course:${courseId}:dashboard`).emit("position:broadcast", {
      sessionId,
      lat,
      lng,
      accuracy,
      holeNumber,
      recordedAt,
    });
  });
}
