import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { sql, eq } from "drizzle-orm";
import { db } from "../../db/connection";
import { sessions, positions, users } from "../../db/schema/index";
import { InMemoryPositionBuffer, type PositionInput } from "../position-buffer";

// ── Test fixtures ─────────────────────────────────────────────────

let sessionId: string;
let sessionId2: string;
let userId: string;
let courseId: string;

beforeAll(async () => {
  // Fetch the seeded course
  const courseRows = await db.execute<{ id: string }>(sql`
    SELECT id FROM courses WHERE slug = 'bordeaux-lac-test' LIMIT 1
  `);
  expect(courseRows[0]).toBeDefined();
  courseId = courseRows[0]!.id;

  // Create a test user for sessions
  const [user] = await db
    .insert(users)
    .values({
      displayName: "Buffer Test User",
      deviceId: `device-buffer-test-${Date.now()}`,
    })
    .returning({ id: users.id });
  userId = user!.id;

  // Create two sessions for testing multi-session buffering
  const [session1] = await db
    .insert(sessions)
    .values({
      userId,
      courseId,
      startedAt: new Date(),
      status: "active",
    })
    .returning({ id: sessions.id });
  sessionId = session1!.id;

  const [session2] = await db
    .insert(sessions)
    .values({
      userId,
      courseId,
      startedAt: new Date(),
      status: "active",
    })
    .returning({ id: sessions.id });
  sessionId2 = session2!.id;
});

afterAll(async () => {
  // Clean up test data in reverse dependency order
  await db
    .delete(positions)
    .where(sql`${positions.sessionId} IN (${sql.raw(`'${sessionId}', '${sessionId2}'`)})`);
  await db.delete(sessions).where(eq(sessions.userId, userId));
  await db.delete(users).where(eq(users.id, userId));
});

// ── Helper ────────────────────────────────────────────────────────

function makePosition(overrides: Partial<PositionInput> = {}): PositionInput {
  return {
    sessionId,
    lat: 44.838 + Math.random() * 0.001,
    lng: -0.579 + Math.random() * 0.001,
    accuracy: 5,
    recordedAt: new Date(),
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────

describe("InMemoryPositionBuffer", () => {
  let buffer: InMemoryPositionBuffer;

  beforeEach(() => {
    buffer = new InMemoryPositionBuffer();
  });

  // ── add + size ────────────────────────────────────────────────

  it("add() increases size()", () => {
    expect(buffer.size()).toBe(0);

    buffer.add(makePosition());
    expect(buffer.size()).toBe(1);

    buffer.add(makePosition());
    expect(buffer.size()).toBe(2);
  });

  // ── flush inserts into DB ─────────────────────────────────────

  it("flush() inserts rows into DB and returns count", async () => {
    buffer.add(makePosition());
    buffer.add(makePosition());
    buffer.add(makePosition());

    const count = await buffer.flush();

    expect(count).toBe(3);

    // Verify rows exist in DB
    const rows = await db.execute<{ cnt: string }>(sql`
      SELECT COUNT(*)::text AS cnt FROM positions WHERE session_id = ${sessionId}
    `);
    expect(Number(rows[0]!.cnt)).toBeGreaterThanOrEqual(3);
  });

  // ── flush clears buffer ───────────────────────────────────────

  it("flush() clears buffer after insert (size becomes 0)", async () => {
    buffer.add(makePosition());
    buffer.add(makePosition());
    expect(buffer.size()).toBe(2);

    await buffer.flush();
    expect(buffer.size()).toBe(0);
  });

  // ── empty flush ───────────────────────────────────────────────

  it("empty flush() returns 0 without DB call", async () => {
    const count = await buffer.flush();
    expect(count).toBe(0);
  });

  // ── multiple sessions ─────────────────────────────────────────

  it("multiple sessions buffered independently", () => {
    buffer.add(makePosition({ sessionId }));
    buffer.add(makePosition({ sessionId }));
    buffer.add(makePosition({ sessionId: sessionId2 }));

    expect(buffer.size()).toBe(3);
  });

  it("flush() inserts positions from multiple sessions", async () => {
    buffer.add(makePosition({ sessionId }));
    buffer.add(makePosition({ sessionId: sessionId2 }));

    const count = await buffer.flush();
    expect(count).toBe(2);

    // Verify both sessions have rows
    const rows1 = await db.execute<{ cnt: string }>(sql`
      SELECT COUNT(*)::text AS cnt FROM positions WHERE session_id = ${sessionId}
    `);
    expect(Number(rows1[0]!.cnt)).toBeGreaterThanOrEqual(1);

    const rows2 = await db.execute<{ cnt: string }>(sql`
      SELECT COUNT(*)::text AS cnt FROM positions WHERE session_id = ${sessionId2}
    `);
    expect(Number(rows2[0]!.cnt)).toBeGreaterThanOrEqual(1);
  });

  // ── start / stop ──────────────────────────────────────────────

  it("start() and stop() manage the flush interval", async () => {
    buffer.add(makePosition());

    buffer.start();
    // Calling start again should be a no-op (no error)
    buffer.start();

    await buffer.stop();

    // After stop, the final flush should have cleared the buffer
    expect(buffer.size()).toBe(0);
  });
});
