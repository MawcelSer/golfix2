import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../app";
import { db } from "../../db/connection";
import { users } from "../../db/schema/core";
import { rounds, scores, sessions } from "../../db/schema/tracking";
import { eq } from "drizzle-orm";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-me";
const BASE = "/api/v1";

function makeToken(userId: string): string {
  return jwt.sign({ sub: userId, type: "access" }, JWT_SECRET, { expiresIn: "15m" });
}

describe("GDPR export", () => {
  let app: FastifyInstance;
  let userId: string;
  let token: string;
  let courseId: string;

  beforeAll(async () => {
    app = await buildApp();
    // Get first course from seed data
    const [course] = await db.execute<{ id: string }>(
      /*sql*/ `SELECT id FROM courses LIMIT 1`,
    );
    if (!course) throw new Error("No seed course found — run pnpm db:seed");
    courseId = course.id;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    const [user] = await db
      .insert(users)
      .values({
        displayName: "GDPR Test User",
        email: `gdpr-${Date.now()}@test.com`,
        passwordHash: "unused",
        gdprConsentAt: new Date(),
      })
      .returning({ id: users.id });

    if (!user) throw new Error("Test setup failed");
    userId = user.id;
    token = makeToken(userId);
  });

  afterEach(async () => {
    // Clean up in FK order: scores → rounds → sessions → user
    const userRounds = await db
      .select({ id: rounds.id })
      .from(rounds)
      .where(eq(rounds.userId, userId));

    for (const r of userRounds) {
      await db.delete(scores).where(eq(scores.roundId, r.id));
    }
    await db.delete(rounds).where(eq(rounds.userId, userId));
    await db.delete(sessions).where(eq(sessions.userId, userId));
    await db.delete(users).where(eq(users.id, userId));
  });

  it("returns user data as JSON for authenticated user", async () => {
    // Create a round with a score
    const [round] = await db
      .insert(rounds)
      .values({
        userId,
        courseId,
        startedAt: new Date(),
        status: "in_progress",
      })
      .returning({ id: rounds.id });

    if (round) {
      await db.insert(scores).values({
        roundId: round.id,
        holeNumber: 1,
        strokes: 4,
        putts: 2,
      });
    }

    // Create a session
    await db.insert(sessions).values({
      userId,
      courseId,
      startedAt: new Date(),
      status: "active",
    });

    const res = await app.inject({
      method: "GET",
      url: `${BASE}/users/me/export`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-disposition"]).toContain("golfix-data-export.json");
    expect(res.headers["content-type"]).toContain("application/json");

    const body = res.json();
    expect(body.profile).toBeDefined();
    expect(body.profile.displayName).toBe("GDPR Test User");
    expect(body.rounds).toHaveLength(1);
    expect(body.rounds[0].scores).toHaveLength(1);
    expect(body.sessions).toHaveLength(1);
  });

  it("returns empty arrays when user has no data", async () => {
    const res = await app.inject({
      method: "GET",
      url: `${BASE}/users/me/export`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.profile).toBeDefined();
    expect(body.rounds).toHaveLength(0);
    expect(body.sessions).toHaveLength(0);
  });

  it("returns 401 for unauthenticated request", async () => {
    const res = await app.inject({
      method: "GET",
      url: `${BASE}/users/me/export`,
    });

    expect(res.statusCode).toBe(401);
  });
});
