import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { db } from "../../db/connection";
import { users } from "../../db/schema/core";
import { sessions, positions } from "../../db/schema/tracking";
import { eq } from "drizzle-orm";
import { processRetention } from "../retention-job";

describe("retention job", () => {
  let userId: string;
  let courseId: string;

  beforeAll(async () => {
    // Get seed course
    const [course] = await db.execute<{ id: string }>(
      /*sql*/ `SELECT id FROM courses LIMIT 1`,
    );
    if (!course) throw new Error("No seed course — run pnpm db:seed");
    courseId = course.id;

    // Create test user
    const [user] = await db
      .insert(users)
      .values({
        displayName: "Retention Test User",
        email: `retention-${Date.now()}@test.com`,
        passwordHash: "unused",
      })
      .returning({ id: users.id });
    if (!user) throw new Error("Setup failed");
    userId = user.id;
  });

  afterAll(async () => {
    await db.delete(users).where(eq(users.id, userId));
  });

  let sessionId: string;

  beforeEach(async () => {
    // Create a session
    const [s] = await db
      .insert(sessions)
      .values({
        userId,
        courseId,
        startedAt: new Date(),
        status: "finished",
      })
      .returning({ id: sessions.id });
    if (!s) throw new Error("Session setup failed");
    sessionId = s.id;
  });

  afterEach(async () => {
    await db.delete(positions).where(eq(positions.sessionId, sessionId));
    await db.delete(sessions).where(eq(sessions.id, sessionId));
  });

  it("aggregates positions older than retention period into session summary", async () => {
    // Insert old positions (13 months ago)
    const oldDate = new Date();
    oldDate.setMonth(oldDate.getMonth() - 13);

    await db.insert(positions).values([
      {
        sessionId,
        location: { x: -0.5792, y: 44.8378 },
        accuracy: 5,
        recordedAt: oldDate,
      },
      {
        sessionId,
        location: { x: -0.5793, y: 44.8379 },
        accuracy: 3,
        recordedAt: new Date(oldDate.getTime() + 60_000),
      },
    ]);

    const result = await processRetention();
    expect(result.sessionsProcessed).toBe(1);
    expect(result.positionsDeleted).toBe(2);

    // Verify positions are deleted
    const remaining = await db
      .select({ id: positions.id })
      .from(positions)
      .where(eq(positions.sessionId, sessionId));
    expect(remaining).toHaveLength(0);

    // Verify session has positionSummary
    const [session] = await db
      .select({ positionSummary: sessions.positionSummary })
      .from(sessions)
      .where(eq(sessions.id, sessionId));
    expect(session?.positionSummary).toBeDefined();
    const summary = session!.positionSummary as {
      count: number;
      firstRecordedAt: string;
      lastRecordedAt: string;
    };
    expect(summary.count).toBe(2);
    expect(summary.firstRecordedAt).toBeDefined();
    expect(summary.lastRecordedAt).toBeDefined();
  });

  it("skips sessions with positions within retention period", async () => {
    // Insert recent positions
    await db.insert(positions).values({
      sessionId,
      location: { x: -0.5792, y: 44.8378 },
      accuracy: 5,
      recordedAt: new Date(), // Now — well within retention
    });

    const result = await processRetention();
    expect(result.sessionsProcessed).toBe(0);
    expect(result.positionsDeleted).toBe(0);

    // Verify positions are untouched
    const remaining = await db
      .select({ id: positions.id })
      .from(positions)
      .where(eq(positions.sessionId, sessionId));
    expect(remaining).toHaveLength(1);
  });

  it("handles empty position sets gracefully", async () => {
    // No positions for this session
    const result = await processRetention();
    expect(result.sessionsProcessed).toBe(0);
    expect(result.positionsDeleted).toBe(0);
  });
});
