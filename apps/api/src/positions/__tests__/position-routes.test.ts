import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { sql } from "drizzle-orm";
import { buildApp } from "../../app";
import { db } from "../../db/connection";
import { courses } from "../../db/schema/index";

const BASE = "/api/v1/positions";
const AUTH_BASE = "/api/v1/auth";
const SESSION_BASE = "/api/v1/sessions";

// ── Helpers ─────────────────────────────────────────────────────────

async function registerAndGetToken(
  app: Awaited<ReturnType<typeof buildApp>>,
  email: string,
): Promise<string> {
  const response = await app.inject({
    method: "POST",
    url: `${AUTH_BASE}/register`,
    payload: {
      email,
      password: "secure-pass-123",
      displayName: "Position Tester",
    },
  });

  const body = response.json();
  return body.accessToken as string;
}

async function startSession(
  app: Awaited<ReturnType<typeof buildApp>>,
  token: string,
  courseId: string,
): Promise<string> {
  const response = await app.inject({
    method: "POST",
    url: `${SESSION_BASE}/start`,
    headers: { authorization: `Bearer ${token}` },
    payload: { courseId },
  });

  const body = response.json();
  return body.sessionId as string;
}

function makePositions(count: number): Array<{
  lat: number;
  lng: number;
  accuracy: number;
  recordedAt: string;
}> {
  return Array.from({ length: count }, (_, i) => ({
    lat: 45.5 + i * 0.0001,
    lng: -73.6 + i * 0.0001,
    accuracy: 5.0,
    recordedAt: new Date(Date.now() - (count - i) * 1000).toISOString(),
  }));
}

// ── Cleanup ─────────────────────────────────────────────────────────

async function cleanTestData(): Promise<void> {
  // Delete positions for test users' sessions
  await db.execute(sql`
    DELETE FROM positions
    WHERE session_id IN (
      SELECT id FROM sessions
      WHERE user_id IN (
        SELECT id FROM users
        WHERE email LIKE '%@test-pos.golfix%'
      )
    )
  `);

  // Delete sessions for test users
  await db.execute(sql`
    DELETE FROM sessions
    WHERE user_id IN (
      SELECT id FROM users
      WHERE email LIKE '%@test-pos.golfix%'
    )
  `);

  // Delete groups created by tests (groups with no sessions)
  await db.execute(sql`
    DELETE FROM groups
    WHERE id NOT IN (SELECT DISTINCT group_id FROM sessions WHERE group_id IS NOT NULL)
    AND date = CURRENT_DATE
  `);

  // Delete refresh tokens for test users
  await db.execute(sql`
    DELETE FROM refresh_tokens
    WHERE user_id IN (
      SELECT id FROM users
      WHERE email LIKE '%@test-pos.golfix%'
    )
  `);

  // Delete test users
  await db.execute(sql`
    DELETE FROM users
    WHERE email LIKE '%@test-pos.golfix%'
  `);
}

// ── Tests ───────────────────────────────────────────────────────────

describe("Position batch routes", () => {
  let courseId: string;

  beforeAll(async () => {
    await cleanTestData();

    // Get a course from the seeded data
    const courseRows = await db
      .select({ id: courses.id })
      .from(courses)
      .limit(1);

    courseId = courseRows[0]!.id;
  });

  afterAll(async () => {
    await cleanTestData();
  });

  // ── POST /positions/batch ───────────────────────────────────────────

  describe("POST /positions/batch", () => {
    it("inserts positions and returns 201 with count", async () => {
      const app = await buildApp();
      const token = await registerAndGetToken(app, "pos-batch-ok@test-pos.golfix.dev");
      const sessionId = await startSession(app, token, courseId);

      const positions = makePositions(5);

      const response = await app.inject({
        method: "POST",
        url: `${BASE}/batch`,
        headers: { authorization: `Bearer ${token}` },
        payload: { sessionId, positions },
      });

      expect(response.statusCode).toBe(201);

      const body = response.json();
      expect(body.inserted).toBe(5);

      await app.close();
    });

    it("returns 401 without auth", async () => {
      const app = await buildApp();

      const response = await app.inject({
        method: "POST",
        url: `${BASE}/batch`,
        payload: {
          sessionId: "00000000-0000-0000-0000-000000000000",
          positions: makePositions(1),
        },
      });

      expect(response.statusCode).toBe(401);

      const body = response.json();
      expect(body.error).toBeDefined();

      await app.close();
    });

    it("returns 400 for invalid sessionId", async () => {
      const app = await buildApp();
      const token = await registerAndGetToken(app, "pos-bad-sid@test-pos.golfix.dev");

      const response = await app.inject({
        method: "POST",
        url: `${BASE}/batch`,
        headers: { authorization: `Bearer ${token}` },
        payload: {
          sessionId: "not-a-uuid",
          positions: makePositions(1),
        },
      });

      expect(response.statusCode).toBe(400);

      const body = response.json();
      expect(body.error).toBeDefined();

      await app.close();
    });

    it("returns 400 for empty positions array", async () => {
      const app = await buildApp();
      const token = await registerAndGetToken(app, "pos-empty@test-pos.golfix.dev");

      const response = await app.inject({
        method: "POST",
        url: `${BASE}/batch`,
        headers: { authorization: `Bearer ${token}` },
        payload: {
          sessionId: "00000000-0000-0000-0000-000000000000",
          positions: [],
        },
      });

      expect(response.statusCode).toBe(400);

      const body = response.json();
      expect(body.error).toBeDefined();

      await app.close();
    });

    it("returns 404 for non-existent session", async () => {
      const app = await buildApp();
      const token = await registerAndGetToken(app, "pos-no-session@test-pos.golfix.dev");

      const response = await app.inject({
        method: "POST",
        url: `${BASE}/batch`,
        headers: { authorization: `Bearer ${token}` },
        payload: {
          sessionId: "00000000-0000-0000-0000-000000000000",
          positions: makePositions(1),
        },
      });

      expect(response.statusCode).toBe(404);

      const body = response.json();
      expect(body.error).toBe("Session not found or not active");

      await app.close();
    });

    it("returns 404 for session owned by another user", async () => {
      const app = await buildApp();

      // User A creates a session
      const tokenA = await registerAndGetToken(app, "pos-owner-a@test-pos.golfix.dev");
      const sessionId = await startSession(app, tokenA, courseId);

      // User B tries to post positions to User A's session
      const tokenB = await registerAndGetToken(app, "pos-owner-b@test-pos.golfix.dev");

      const response = await app.inject({
        method: "POST",
        url: `${BASE}/batch`,
        headers: { authorization: `Bearer ${tokenB}` },
        payload: {
          sessionId,
          positions: makePositions(1),
        },
      });

      expect(response.statusCode).toBe(404);

      const body = response.json();
      expect(body.error).toBe("Session not found or not active");

      await app.close();
    });

    it("returns 400 for invalid position data", async () => {
      const app = await buildApp();
      const token = await registerAndGetToken(app, "pos-invalid@test-pos.golfix.dev");

      const response = await app.inject({
        method: "POST",
        url: `${BASE}/batch`,
        headers: { authorization: `Bearer ${token}` },
        payload: {
          sessionId: "00000000-0000-0000-0000-000000000000",
          positions: [
            {
              lat: 999,
              lng: -73.6,
              accuracy: 5.0,
              recordedAt: new Date().toISOString(),
            },
          ],
        },
      });

      expect(response.statusCode).toBe(400);

      const body = response.json();
      expect(body.error).toBeDefined();

      await app.close();
    });
  });
});
