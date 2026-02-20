import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../app";
import { db } from "../../db/connection";
import { users } from "../../db/schema/core";
import { rounds, scores, sessions } from "../../db/schema/tracking";
import { eq } from "drizzle-orm";
import jwt from "jsonwebtoken";
import { hashPassword } from "../../auth/auth-service";

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

describe("GDPR deletion", () => {
  let app: FastifyInstance;
  let courseId: string;

  beforeAll(async () => {
    app = await buildApp();
    const [course] = await db.execute<{ id: string }>(
      /*sql*/ `SELECT id FROM courses LIMIT 1`,
    );
    if (!course) throw new Error("No seed course found — run pnpm db:seed");
    courseId = course.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it("deletes email user with correct password confirmation", async () => {
    const password = "Test1234!";
    const passwordHash = await hashPassword(password);

    const [user] = await db
      .insert(users)
      .values({
        displayName: "Delete Me",
        email: `delete-${Date.now()}@test.com`,
        passwordHash,
        gdprConsentAt: new Date(),
      })
      .returning({ id: users.id });
    if (!user) throw new Error("Setup failed");

    // Create associated data
    await db.insert(sessions).values({
      userId: user.id,
      courseId,
      startedAt: new Date(),
      status: "active",
    });

    const token = makeToken(user.id);
    const res = await app.inject({
      method: "DELETE",
      url: `${BASE}/users/me`,
      headers: { authorization: `Bearer ${token}` },
      payload: { password },
    });

    expect(res.statusCode).toBe(204);

    // Verify user is gone
    const [found] = await db.select({ id: users.id }).from(users).where(eq(users.id, user.id));
    expect(found).toBeUndefined();

    // Verify session is anonymized (userId nulled), not deleted
    const userSessions = await db
      .select({ id: sessions.id, userId: sessions.userId })
      .from(sessions)
      .where(eq(sessions.courseId, courseId));
    const anonymized = userSessions.find((s) => s.userId === null);
    expect(anonymized).toBeDefined();

    // Clean up anonymized session
    if (anonymized) {
      await db.delete(sessions).where(eq(sessions.id, anonymized.id));
    }
  });

  it("deletes anonymous user without password", async () => {
    const [user] = await db
      .insert(users)
      .values({
        displayName: "Anon User",
        deviceId: `device-${Date.now()}`,
      })
      .returning({ id: users.id });
    if (!user) throw new Error("Setup failed");

    const token = makeToken(user.id);
    const res = await app.inject({
      method: "DELETE",
      url: `${BASE}/users/me`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(204);

    const [found] = await db.select({ id: users.id }).from(users).where(eq(users.id, user.id));
    expect(found).toBeUndefined();
  });

  it("rejects deletion with wrong password", async () => {
    const passwordHash = await hashPassword("correct-password");
    const [user] = await db
      .insert(users)
      .values({
        displayName: "Wrong Pwd User",
        email: `wrongpwd-${Date.now()}@test.com`,
        passwordHash,
      })
      .returning({ id: users.id });
    if (!user) throw new Error("Setup failed");

    const token = makeToken(user.id);
    const res = await app.inject({
      method: "DELETE",
      url: `${BASE}/users/me`,
      headers: { authorization: `Bearer ${token}` },
      payload: { password: "wrong-password" },
    });

    expect(res.statusCode).toBe(403);

    // Clean up — user should still exist
    await db.delete(users).where(eq(users.id, user.id));
  });

  it("returns 401 for unauthenticated request", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `${BASE}/users/me`,
    });

    expect(res.statusCode).toBe(401);
  });
});
