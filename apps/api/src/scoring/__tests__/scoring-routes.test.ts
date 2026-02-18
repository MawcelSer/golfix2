import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { sql } from "drizzle-orm";
import { buildApp } from "../../app";
import { db } from "../../db/connection";
import { courses } from "../../db/schema/index";

const BASE = "/api/v1";
const AUTH_BASE = "/api/v1/auth";

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
      displayName: "Scoring Tester",
    },
  });

  const body = response.json();
  return body.accessToken as string;
}

// ── Cleanup ─────────────────────────────────────────────────────────

async function cleanTestData(): Promise<void> {
  // Delete scores for rounds owned by test users
  await db.execute(sql`
    DELETE FROM scores
    WHERE round_id IN (
      SELECT id FROM rounds
      WHERE user_id IN (
        SELECT id FROM users WHERE email LIKE '%@test-scoring.golfix%'
      )
    )
  `);

  // Delete rounds for test users
  await db.execute(sql`
    DELETE FROM rounds
    WHERE user_id IN (
      SELECT id FROM users WHERE email LIKE '%@test-scoring.golfix%'
    )
  `);

  // Delete sessions for test users
  await db.execute(sql`
    DELETE FROM sessions
    WHERE user_id IN (
      SELECT id FROM users WHERE email LIKE '%@test-scoring.golfix%'
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
      SELECT id FROM users WHERE email LIKE '%@test-scoring.golfix%'
    )
  `);

  // Delete test users
  await db.execute(sql`
    DELETE FROM users WHERE email LIKE '%@test-scoring.golfix%'
  `);
}

// ── Tests ───────────────────────────────────────────────────────────

describe("Scoring routes", () => {
  let courseId: string;

  beforeAll(async () => {
    await cleanTestData();

    // Get a course from the seeded data
    const courseRows = await db.select({ id: courses.id }).from(courses).limit(1);

    courseId = courseRows[0]!.id;
  });

  afterAll(async () => {
    await cleanTestData();
  });

  // ── POST /rounds ──────────────────────────────────────────────────

  describe("POST /rounds", () => {
    it("creates a round and returns 201", async () => {
      const app = await buildApp();
      const token = await registerAndGetToken(app, "scoring-create@test-scoring.golfix.dev");

      const response = await app.inject({
        method: "POST",
        url: `${BASE}/rounds`,
        headers: { authorization: `Bearer ${token}` },
        payload: { courseId },
      });

      expect(response.statusCode).toBe(201);

      const body = response.json();
      expect(body.id).toBeDefined();
      expect(body.courseId).toBe(courseId);
      expect(body.userId).toBeDefined();
      expect(body.status).toBe("in_progress");
      expect(body.startedAt).toBeDefined();
      expect(body.sessionId).toBeNull();

      await app.close();
    });

    it("creates a round with sessionId", async () => {
      const app = await buildApp();
      const token = await registerAndGetToken(app, "scoring-with-session@test-scoring.golfix.dev");

      // Start a session first
      const sessionRes = await app.inject({
        method: "POST",
        url: `${BASE}/sessions/start`,
        headers: { authorization: `Bearer ${token}` },
        payload: { courseId },
      });

      const { sessionId } = sessionRes.json();

      const response = await app.inject({
        method: "POST",
        url: `${BASE}/rounds`,
        headers: { authorization: `Bearer ${token}` },
        payload: { courseId, sessionId },
      });

      expect(response.statusCode).toBe(201);

      const body = response.json();
      expect(body.sessionId).toBe(sessionId);

      await app.close();
    });

    it("returns 401 without auth", async () => {
      const app = await buildApp();

      const response = await app.inject({
        method: "POST",
        url: `${BASE}/rounds`,
        payload: { courseId },
      });

      expect(response.statusCode).toBe(401);

      await app.close();
    });

    it("returns 400 for invalid courseId", async () => {
      const app = await buildApp();
      const token = await registerAndGetToken(app, "scoring-bad-id@test-scoring.golfix.dev");

      const response = await app.inject({
        method: "POST",
        url: `${BASE}/rounds`,
        headers: { authorization: `Bearer ${token}` },
        payload: { courseId: "not-a-uuid" },
      });

      expect(response.statusCode).toBe(400);

      const body = response.json();
      expect(body.error).toBeDefined();

      await app.close();
    });

    it("returns 404 for non-existent course", async () => {
      const app = await buildApp();
      const token = await registerAndGetToken(app, "scoring-no-course@test-scoring.golfix.dev");

      const response = await app.inject({
        method: "POST",
        url: `${BASE}/rounds`,
        headers: { authorization: `Bearer ${token}` },
        payload: { courseId: "00000000-0000-0000-0000-000000000000" },
      });

      expect(response.statusCode).toBe(404);

      const body = response.json();
      expect(body.error).toBe("Course not found");

      await app.close();
    });
  });

  // ── PUT /rounds/:id/scores ────────────────────────────────────────

  describe("PUT /rounds/:id/scores", () => {
    it("creates a score and returns 200", async () => {
      const app = await buildApp();
      const token = await registerAndGetToken(app, "scoring-upsert@test-scoring.golfix.dev");

      // Create a round
      const roundRes = await app.inject({
        method: "POST",
        url: `${BASE}/rounds`,
        headers: { authorization: `Bearer ${token}` },
        payload: { courseId },
      });

      const { id: roundId } = roundRes.json();

      const response = await app.inject({
        method: "PUT",
        url: `${BASE}/rounds/${roundId}/scores`,
        headers: { authorization: `Bearer ${token}` },
        payload: {
          holeNumber: 1,
          strokes: 4,
          putts: 2,
          fairwayHit: true,
          greenInRegulation: true,
        },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.roundId).toBe(roundId);
      expect(body.holeNumber).toBe(1);
      expect(body.strokes).toBe(4);
      expect(body.putts).toBe(2);
      expect(body.fairwayHit).toBe(true);
      expect(body.greenInRegulation).toBe(true);

      await app.close();
    });

    it("updates an existing score (upsert)", async () => {
      const app = await buildApp();
      const token = await registerAndGetToken(app, "scoring-update@test-scoring.golfix.dev");

      // Create a round
      const roundRes = await app.inject({
        method: "POST",
        url: `${BASE}/rounds`,
        headers: { authorization: `Bearer ${token}` },
        payload: { courseId },
      });

      const { id: roundId } = roundRes.json();

      // Insert score for hole 3
      await app.inject({
        method: "PUT",
        url: `${BASE}/rounds/${roundId}/scores`,
        headers: { authorization: `Bearer ${token}` },
        payload: { holeNumber: 3, strokes: 5 },
      });

      // Update score for hole 3
      const response = await app.inject({
        method: "PUT",
        url: `${BASE}/rounds/${roundId}/scores`,
        headers: { authorization: `Bearer ${token}` },
        payload: { holeNumber: 3, strokes: 4, putts: 1, fairwayHit: false },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.holeNumber).toBe(3);
      expect(body.strokes).toBe(4);
      expect(body.putts).toBe(1);
      expect(body.fairwayHit).toBe(false);

      await app.close();
    });

    it("returns 400 for invalid score data", async () => {
      const app = await buildApp();
      const token = await registerAndGetToken(app, "scoring-bad-score@test-scoring.golfix.dev");

      // Create a round
      const roundRes = await app.inject({
        method: "POST",
        url: `${BASE}/rounds`,
        headers: { authorization: `Bearer ${token}` },
        payload: { courseId },
      });

      const { id: roundId } = roundRes.json();

      const response = await app.inject({
        method: "PUT",
        url: `${BASE}/rounds/${roundId}/scores`,
        headers: { authorization: `Bearer ${token}` },
        payload: { holeNumber: 0, strokes: -1 },
      });

      expect(response.statusCode).toBe(400);

      const body = response.json();
      expect(body.error).toBeDefined();

      await app.close();
    });

    it("returns 404 for non-existent round", async () => {
      const app = await buildApp();
      const token = await registerAndGetToken(app, "scoring-no-round@test-scoring.golfix.dev");

      const response = await app.inject({
        method: "PUT",
        url: `${BASE}/rounds/00000000-0000-0000-0000-000000000000/scores`,
        headers: { authorization: `Bearer ${token}` },
        payload: { holeNumber: 1, strokes: 4 },
      });

      expect(response.statusCode).toBe(404);

      const body = response.json();
      expect(body.error).toBe("Round not found");

      await app.close();
    });

    it("returns 403 when modifying another user's round", async () => {
      const app = await buildApp();
      const token1 = await registerAndGetToken(app, "scoring-owner@test-scoring.golfix.dev");
      const token2 = await registerAndGetToken(app, "scoring-other@test-scoring.golfix.dev");

      // User 1 creates a round
      const roundRes = await app.inject({
        method: "POST",
        url: `${BASE}/rounds`,
        headers: { authorization: `Bearer ${token1}` },
        payload: { courseId },
      });

      const { id: roundId } = roundRes.json();

      // User 2 tries to add a score
      const response = await app.inject({
        method: "PUT",
        url: `${BASE}/rounds/${roundId}/scores`,
        headers: { authorization: `Bearer ${token2}` },
        payload: { holeNumber: 1, strokes: 4 },
      });

      expect(response.statusCode).toBe(403);

      const body = response.json();
      expect(body.error).toBe("Not authorized to modify this round");

      await app.close();
    });

    it("returns 401 without auth", async () => {
      const app = await buildApp();

      const response = await app.inject({
        method: "PUT",
        url: `${BASE}/rounds/00000000-0000-0000-0000-000000000000/scores`,
        payload: { holeNumber: 1, strokes: 4 },
      });

      expect(response.statusCode).toBe(401);

      await app.close();
    });
  });

  // ── GET /users/me/rounds ──────────────────────────────────────────

  describe("GET /users/me/rounds", () => {
    it("returns empty array for new user", async () => {
      const app = await buildApp();
      const token = await registerAndGetToken(app, "scoring-list-empty@test-scoring.golfix.dev");

      const response = await app.inject({
        method: "GET",
        url: `${BASE}/users/me/rounds`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(Array.isArray(body)).toBe(true);
      expect(body).toHaveLength(0);

      await app.close();
    });

    it("returns rounds with computed total strokes", async () => {
      const app = await buildApp();
      const token = await registerAndGetToken(app, "scoring-list@test-scoring.golfix.dev");

      // Create a round and add scores
      const roundRes = await app.inject({
        method: "POST",
        url: `${BASE}/rounds`,
        headers: { authorization: `Bearer ${token}` },
        payload: { courseId },
      });

      const { id: roundId } = roundRes.json();

      // Add scores for holes 1-3
      await app.inject({
        method: "PUT",
        url: `${BASE}/rounds/${roundId}/scores`,
        headers: { authorization: `Bearer ${token}` },
        payload: { holeNumber: 1, strokes: 4 },
      });

      await app.inject({
        method: "PUT",
        url: `${BASE}/rounds/${roundId}/scores`,
        headers: { authorization: `Bearer ${token}` },
        payload: { holeNumber: 2, strokes: 3 },
      });

      await app.inject({
        method: "PUT",
        url: `${BASE}/rounds/${roundId}/scores`,
        headers: { authorization: `Bearer ${token}` },
        payload: { holeNumber: 3, strokes: 5 },
      });

      const response = await app.inject({
        method: "GET",
        url: `${BASE}/users/me/rounds`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body).toHaveLength(1);
      expect(body[0].id).toBe(roundId);
      expect(body[0].computedTotalStrokes).toBe(12); // 4 + 3 + 5

      await app.close();
    });

    it("returns 401 without auth", async () => {
      const app = await buildApp();

      const response = await app.inject({
        method: "GET",
        url: `${BASE}/users/me/rounds`,
      });

      expect(response.statusCode).toBe(401);

      await app.close();
    });
  });

  // ── GET /rounds/:id ───────────────────────────────────────────────

  describe("GET /rounds/:id", () => {
    it("returns round detail with scores", async () => {
      const app = await buildApp();
      const token = await registerAndGetToken(app, "scoring-detail@test-scoring.golfix.dev");

      // Create a round and add scores
      const roundRes = await app.inject({
        method: "POST",
        url: `${BASE}/rounds`,
        headers: { authorization: `Bearer ${token}` },
        payload: { courseId },
      });

      const { id: roundId } = roundRes.json();

      // Add scores
      await app.inject({
        method: "PUT",
        url: `${BASE}/rounds/${roundId}/scores`,
        headers: { authorization: `Bearer ${token}` },
        payload: { holeNumber: 1, strokes: 4, putts: 2 },
      });

      await app.inject({
        method: "PUT",
        url: `${BASE}/rounds/${roundId}/scores`,
        headers: { authorization: `Bearer ${token}` },
        payload: { holeNumber: 2, strokes: 5, putts: 3, fairwayHit: false },
      });

      const response = await app.inject({
        method: "GET",
        url: `${BASE}/rounds/${roundId}`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.id).toBe(roundId);
      expect(body.courseId).toBe(courseId);
      expect(body.scores).toHaveLength(2);
      expect(body.scores[0].holeNumber).toBe(1);
      expect(body.scores[0].strokes).toBe(4);
      expect(body.scores[1].holeNumber).toBe(2);
      expect(body.scores[1].strokes).toBe(5);

      await app.close();
    });

    it("returns 404 for non-existent round", async () => {
      const app = await buildApp();
      const token = await registerAndGetToken(app, "scoring-detail-404@test-scoring.golfix.dev");

      const response = await app.inject({
        method: "GET",
        url: `${BASE}/rounds/00000000-0000-0000-0000-000000000000`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(404);

      const body = response.json();
      expect(body.error).toBe("Round not found");

      await app.close();
    });

    it("returns 403 for another user's round", async () => {
      const app = await buildApp();
      const token1 = await registerAndGetToken(app, "scoring-detail-owner@test-scoring.golfix.dev");
      const token2 = await registerAndGetToken(app, "scoring-detail-other@test-scoring.golfix.dev");

      // User 1 creates a round
      const roundRes = await app.inject({
        method: "POST",
        url: `${BASE}/rounds`,
        headers: { authorization: `Bearer ${token1}` },
        payload: { courseId },
      });

      const { id: roundId } = roundRes.json();

      // User 2 tries to view it
      const response = await app.inject({
        method: "GET",
        url: `${BASE}/rounds/${roundId}`,
        headers: { authorization: `Bearer ${token2}` },
      });

      expect(response.statusCode).toBe(403);

      const body = response.json();
      expect(body.error).toBe("Not authorized to view this round");

      await app.close();
    });

    it("returns 401 without auth", async () => {
      const app = await buildApp();

      const response = await app.inject({
        method: "GET",
        url: `${BASE}/rounds/00000000-0000-0000-0000-000000000000`,
      });

      expect(response.statusCode).toBe(401);

      await app.close();
    });
  });
});
