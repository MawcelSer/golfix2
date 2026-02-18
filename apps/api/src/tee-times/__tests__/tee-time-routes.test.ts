import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { sql } from "drizzle-orm";
import { buildApp } from "../../app";
import { db } from "../../db/connection";
import { courses, courseRoles } from "../../db/schema/index";

const AUTH_BASE = "/api/v1/auth";

// ── Helpers ─────────────────────────────────────────────────────────

let accessToken: string;
let courseId: string;
let userId: string;

function teeTimesUrl(cId: string = courseId): string {
  return `/api/v1/courses/${cId}/tee-times`;
}

async function registerAndGetToken(
  app: Awaited<ReturnType<typeof buildApp>>,
  email: string,
): Promise<{ token: string; userId: string }> {
  const response = await app.inject({
    method: "POST",
    url: `${AUTH_BASE}/register`,
    payload: {
      email,
      password: "secure-pass-123",
      displayName: "TeeTime Tester",
    },
  });

  const body = response.json();
  return { token: body.accessToken as string, userId: body.user.id as string };
}

// ── Cleanup ─────────────────────────────────────────────────────────

const TEST_EMAIL_PATTERN = "%@test-teetime.golfix%";

async function cleanTestData(): Promise<void> {
  await db.execute(sql`
    DELETE FROM tee_times
    WHERE course_id IN (SELECT id FROM courses)
    AND created_at > NOW() - INTERVAL '1 hour'
    AND id IN (
      SELECT tt.id FROM tee_times tt
      WHERE tt.notes LIKE '%test%' OR tt.notes IS NULL
    )
  `);

  await db.execute(sql`
    DELETE FROM course_roles
    WHERE user_id IN (
      SELECT id FROM users WHERE email LIKE ${TEST_EMAIL_PATTERN}
    )
  `);

  await db.execute(sql`
    DELETE FROM refresh_tokens
    WHERE user_id IN (
      SELECT id FROM users WHERE email LIKE ${TEST_EMAIL_PATTERN}
    )
  `);

  await db.execute(sql`
    DELETE FROM users WHERE email LIKE ${TEST_EMAIL_PATTERN}
  `);
}

// ── Tests ───────────────────────────────────────────────────────────

describe("Tee time routes", () => {
  beforeAll(async () => {
    await cleanTestData();

    const courseRows = await db.select({ id: courses.id }).from(courses).limit(1);
    courseId = courseRows[0]!.id;

    const app = await buildApp();
    const auth = await registerAndGetToken(app, "admin@test-teetime.golfix.dev");
    accessToken = auth.token;
    userId = auth.userId;

    // Grant admin role on the course
    await db.insert(courseRoles).values({
      userId,
      courseId,
      role: "admin",
    });

    await app.close();
  });

  afterAll(async () => {
    await cleanTestData();
  });

  // ── POST (create) ──────────────────────────────────────────────────

  describe("POST /courses/:courseId/tee-times", () => {
    it("creates a tee time (201)", async () => {
      const app = await buildApp();

      const response = await app.inject({
        method: "POST",
        url: teeTimesUrl(),
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          scheduledAt: "2026-03-15T08:00:00.000Z",
          playersCount: 4,
          notes: "test morning slot",
        },
      });

      expect(response.statusCode).toBe(201);

      const body = response.json();
      expect(body.id).toBeDefined();
      expect(body.courseId).toBe(courseId);
      expect(body.playersCount).toBe(4);
      expect(body.notes).toBe("test morning slot");

      await app.close();
    });

    it("returns 400 for invalid scheduledAt", async () => {
      const app = await buildApp();

      const response = await app.inject({
        method: "POST",
        url: teeTimesUrl(),
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { scheduledAt: "not-a-date" },
      });

      expect(response.statusCode).toBe(400);
      await app.close();
    });

    it("returns 401 without auth", async () => {
      const app = await buildApp();

      const response = await app.inject({
        method: "POST",
        url: teeTimesUrl(),
        payload: { scheduledAt: "2026-03-15T08:00:00.000Z" },
      });

      expect(response.statusCode).toBe(401);
      await app.close();
    });

    it("returns 403 without course role", async () => {
      const app = await buildApp();

      // Register a user without a course role
      const auth = await registerAndGetToken(app, "norole@test-teetime.golfix.dev");

      const response = await app.inject({
        method: "POST",
        url: teeTimesUrl(),
        headers: { authorization: `Bearer ${auth.token}` },
        payload: { scheduledAt: "2026-03-15T08:00:00.000Z" },
      });

      expect(response.statusCode).toBe(403);
      await app.close();
    });
  });

  // ── GET (list) ─────────────────────────────────────────────────────

  describe("GET /courses/:courseId/tee-times", () => {
    it("lists tee times for a date (200)", async () => {
      const app = await buildApp();

      // Create a tee time first
      await app.inject({
        method: "POST",
        url: teeTimesUrl(),
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          scheduledAt: "2026-04-01T09:00:00.000Z",
          playersCount: 3,
          notes: "test list slot",
        },
      });

      const response = await app.inject({
        method: "GET",
        url: `${teeTimesUrl()}?date=2026-04-01`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThanOrEqual(1);
      expect(body[0].scheduledAt).toContain("2026-04-01");

      await app.close();
    });

    it("returns empty array for date with no tee times", async () => {
      const app = await buildApp();

      const response = await app.inject({
        method: "GET",
        url: `${teeTimesUrl()}?date=2020-01-01`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body).toEqual([]);

      await app.close();
    });
  });

  // ── GET /:teeTimeId ───────────────────────────────────────────────

  describe("GET /courses/:courseId/tee-times/:teeTimeId", () => {
    it("returns a single tee time (200)", async () => {
      const app = await buildApp();

      const createRes = await app.inject({
        method: "POST",
        url: teeTimesUrl(),
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { scheduledAt: "2026-04-02T10:00:00.000Z", notes: "test get single" },
      });

      const created = createRes.json();

      const response = await app.inject({
        method: "GET",
        url: `${teeTimesUrl()}/${created.id}`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().id).toBe(created.id);

      await app.close();
    });

    it("returns 404 for unknown tee time", async () => {
      const app = await buildApp();

      const response = await app.inject({
        method: "GET",
        url: `${teeTimesUrl()}/00000000-0000-0000-0000-000000000000`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(404);
      await app.close();
    });
  });

  // ── PUT /:teeTimeId ──────────────────────────────────────────────

  describe("PUT /courses/:courseId/tee-times/:teeTimeId", () => {
    it("updates a tee time (200)", async () => {
      const app = await buildApp();

      const createRes = await app.inject({
        method: "POST",
        url: teeTimesUrl(),
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { scheduledAt: "2026-04-03T11:00:00.000Z", playersCount: 4, notes: "test update" },
      });

      const created = createRes.json();

      const response = await app.inject({
        method: "PUT",
        url: `${teeTimesUrl()}/${created.id}`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { playersCount: 2, notes: "updated notes" },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.playersCount).toBe(2);
      expect(body.notes).toBe("updated notes");

      await app.close();
    });
  });

  // ── DELETE /:teeTimeId ────────────────────────────────────────────

  describe("DELETE /courses/:courseId/tee-times/:teeTimeId", () => {
    it("deletes a tee time (204)", async () => {
      const app = await buildApp();

      const createRes = await app.inject({
        method: "POST",
        url: teeTimesUrl(),
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { scheduledAt: "2026-04-04T12:00:00.000Z", notes: "test delete" },
      });

      const created = createRes.json();

      const deleteRes = await app.inject({
        method: "DELETE",
        url: `${teeTimesUrl()}/${created.id}`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(deleteRes.statusCode).toBe(204);

      // Verify it's gone
      const getRes = await app.inject({
        method: "GET",
        url: `${teeTimesUrl()}/${created.id}`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(getRes.statusCode).toBe(404);

      await app.close();
    });

    it("returns 404 for unknown tee time", async () => {
      const app = await buildApp();

      const response = await app.inject({
        method: "DELETE",
        url: `${teeTimesUrl()}/00000000-0000-0000-0000-000000000000`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(404);
      await app.close();
    });
  });
});
