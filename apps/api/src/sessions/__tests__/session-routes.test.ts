import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { sql } from "drizzle-orm";
import { buildApp } from "../../app";
import { db } from "../../db/connection";
import { courses } from "../../db/schema/index";

const BASE = "/api/v1/sessions";
const AUTH_BASE = "/api/v1/auth";

// ── Helpers ─────────────────────────────────────────────────────────

let accessToken: string;
let courseId: string;

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
      displayName: "Session Tester",
    },
  });

  const body = response.json();
  return body.accessToken as string;
}

// ── Cleanup ─────────────────────────────────────────────────────────

async function cleanTestData(): Promise<void> {
  // Delete sessions for test users
  await db.execute(sql`
    DELETE FROM sessions
    WHERE user_id IN (
      SELECT id FROM users
      WHERE email LIKE '%@test.golfix%'
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
      WHERE email LIKE '%@test.golfix%'
    )
  `);

  // Delete test users
  await db.execute(sql`
    DELETE FROM users
    WHERE email LIKE '%@test.golfix%'
  `);
}

// ── Tests ───────────────────────────────────────────────────────────

describe("Session routes", () => {
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

  // ── POST /sessions/start ──────────────────────────────────────────

  describe("POST /sessions/start", () => {
    it("creates a session and returns 201", async () => {
      const app = await buildApp();
      accessToken = await registerAndGetToken(app, "session-start@test.golfix.dev");

      const response = await app.inject({
        method: "POST",
        url: `${BASE}/start`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { courseId },
      });

      expect(response.statusCode).toBe(201);

      const body = response.json();
      expect(body.sessionId).toBeDefined();
      expect(body.groupId).toBeDefined();
      expect(body.courseId).toBe(courseId);

      await app.close();
    });

    it("returns 401 without auth", async () => {
      const app = await buildApp();

      const response = await app.inject({
        method: "POST",
        url: `${BASE}/start`,
        payload: { courseId },
      });

      expect(response.statusCode).toBe(401);

      const body = response.json();
      expect(body.error).toBeDefined();

      await app.close();
    });

    it("returns 400 for invalid courseId", async () => {
      const app = await buildApp();
      accessToken = await registerAndGetToken(app, "session-bad-id@test.golfix.dev");

      const response = await app.inject({
        method: "POST",
        url: `${BASE}/start`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { courseId: "not-a-uuid" },
      });

      expect(response.statusCode).toBe(400);

      const body = response.json();
      expect(body.error).toBeDefined();

      await app.close();
    });

    it("returns 404 for non-existent course", async () => {
      const app = await buildApp();
      accessToken = await registerAndGetToken(app, "session-no-course@test.golfix.dev");

      const response = await app.inject({
        method: "POST",
        url: `${BASE}/start`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { courseId: "00000000-0000-0000-0000-000000000000" },
      });

      expect(response.statusCode).toBe(404);

      const body = response.json();
      expect(body.error).toBe("Course not found");

      await app.close();
    });
  });

  // ── GET /sessions/:id ─────────────────────────────────────────────

  describe("GET /sessions/:id", () => {
    it("returns session data (200)", async () => {
      const app = await buildApp();
      accessToken = await registerAndGetToken(app, "session-get@test.golfix.dev");

      // Start a session first
      const startResponse = await app.inject({
        method: "POST",
        url: `${BASE}/start`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { courseId },
      });

      const { sessionId } = startResponse.json();

      // Get the session
      const response = await app.inject({
        method: "GET",
        url: `${BASE}/${sessionId}`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.id).toBe(sessionId);
      expect(body.courseId).toBe(courseId);
      expect(body.status).toBe("active");
      expect(body.startedAt).toBeDefined();

      await app.close();
    });

    it("returns 404 for non-existent session", async () => {
      const app = await buildApp();
      accessToken = await registerAndGetToken(app, "session-get-404@test.golfix.dev");

      const response = await app.inject({
        method: "GET",
        url: `${BASE}/00000000-0000-0000-0000-000000000000`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(404);

      await app.close();
    });
  });

  // ── PATCH /sessions/:id/finish ────────────────────────────────────

  describe("PATCH /sessions/:id/finish", () => {
    it("finishes a session (200)", async () => {
      const app = await buildApp();
      accessToken = await registerAndGetToken(app, "session-finish@test.golfix.dev");

      // Start a session first
      const startResponse = await app.inject({
        method: "POST",
        url: `${BASE}/start`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { courseId },
      });

      const { sessionId } = startResponse.json();

      // Finish the session
      const response = await app.inject({
        method: "PATCH",
        url: `${BASE}/${sessionId}/finish`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { status: "finished" },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.id).toBe(sessionId);
      expect(body.status).toBe("finished");
      expect(body.finishedAt).toBeDefined();

      await app.close();
    });

    it("returns 409 when finishing an already-finished session", async () => {
      const app = await buildApp();
      accessToken = await registerAndGetToken(app, "session-double-finish@test.golfix.dev");

      // Start a session
      const startResponse = await app.inject({
        method: "POST",
        url: `${BASE}/start`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { courseId },
      });

      const { sessionId } = startResponse.json();

      // Finish it once
      await app.inject({
        method: "PATCH",
        url: `${BASE}/${sessionId}/finish`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { status: "finished" },
      });

      // Try to finish again
      const response = await app.inject({
        method: "PATCH",
        url: `${BASE}/${sessionId}/finish`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { status: "finished" },
      });

      expect(response.statusCode).toBe(409);

      const body = response.json();
      expect(body.error).toBe("Session is not active");

      await app.close();
    });

    it("supports abandoned status", async () => {
      const app = await buildApp();
      accessToken = await registerAndGetToken(app, "session-abandon@test.golfix.dev");

      // Start a session
      const startResponse = await app.inject({
        method: "POST",
        url: `${BASE}/start`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { courseId },
      });

      const { sessionId } = startResponse.json();

      // Abandon the session
      const response = await app.inject({
        method: "PATCH",
        url: `${BASE}/${sessionId}/finish`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { status: "abandoned" },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.status).toBe("abandoned");
      expect(body.finishedAt).toBeDefined();

      await app.close();
    });
  });
});
