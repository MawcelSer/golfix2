import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { sql } from "drizzle-orm";
import jwt from "jsonwebtoken";
import { buildApp } from "../../app";
import { db } from "../../db/connection";
import { users, courses, courseRoles } from "../../db/schema/index";
import { generateAccessToken } from "../../auth/auth-service";
import { verifyToken, requireRole } from "../auth-middleware";
import type { FastifyInstance } from "fastify";

// ── Test state ──────────────────────────────────────────────────────

let app: FastifyInstance;
let testUserId: string;
let testCourseId: string;
let validToken: string;

// ── Setup & Teardown ────────────────────────────────────────────────

async function cleanTestData(): Promise<void> {
  await db.execute(sql`
    DELETE FROM course_roles
    WHERE user_id IN (
      SELECT id FROM users WHERE email LIKE '%@test.middleware%'
    )
  `);
  await db.execute(sql`
    DELETE FROM refresh_tokens
    WHERE user_id IN (
      SELECT id FROM users WHERE email LIKE '%@test.middleware%'
    )
  `);
  await db.execute(sql`DELETE FROM users WHERE email LIKE '%@test.middleware%'`);
}

beforeAll(async () => {
  await cleanTestData();

  // Create a test user
  const [user] = await db
    .insert(users)
    .values({
      email: "auth@test.middleware",
      displayName: "Auth Test User",
      passwordHash: "$2b$12$placeholder.hash.for.testing.only",
    })
    .returning({ id: users.id });

  testUserId = user!.id;
  validToken = generateAccessToken(testUserId);

  // Find the seed course (or any existing course)
  const courseRows = await db.select({ id: courses.id }).from(courses).limit(1);

  testCourseId = courseRows[0]!.id;

  // Give the test user "admin" role on that course
  await db.insert(courseRoles).values({
    userId: testUserId,
    courseId: testCourseId,
    role: "admin",
  });

  // Build the Fastify app and register test routes
  app = await buildApp();

  app.get("/test/protected", { preHandler: [verifyToken] }, async (request) => {
    return { userId: request.userId };
  });

  app.get(
    "/test/admin/:courseId",
    { preHandler: [verifyToken, requireRole("owner", "admin")] },
    async () => {
      return { ok: true };
    },
  );

  app.get(
    "/test/marshal/:courseId",
    { preHandler: [verifyToken, requireRole("marshal")] },
    async () => {
      return { ok: true };
    },
  );

  await app.ready();
});

afterAll(async () => {
  await cleanTestData();
  await app.close();
});

// ── verifyToken tests ───────────────────────────────────────────────

describe("verifyToken", () => {
  it("returns 401 when Authorization header is missing", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/test/protected",
    });

    expect(response.statusCode).toBe(401);

    const body = response.json();
    expect(body.error).toBe("Missing or invalid authorization header");
  });

  it("returns 401 when Authorization header has wrong scheme", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/test/protected",
      headers: { authorization: "Basic abc123" },
    });

    expect(response.statusCode).toBe(401);

    const body = response.json();
    expect(body.error).toBe("Missing or invalid authorization header");
  });

  it("returns 401 when token is malformed", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/test/protected",
      headers: { authorization: "Bearer not-a-valid-jwt" },
    });

    expect(response.statusCode).toBe(401);

    const body = response.json();
    expect(body.error).toBe("Invalid or expired token");
  });

  it("returns 401 when token is expired", async () => {
    const secret = process.env.JWT_SECRET ?? "dev-secret-change-me";
    const expiredToken = jwt.sign({ sub: testUserId }, secret, { expiresIn: "-1s" });

    const response = await app.inject({
      method: "GET",
      url: "/test/protected",
      headers: { authorization: `Bearer ${expiredToken}` },
    });

    expect(response.statusCode).toBe(401);

    const body = response.json();
    expect(body.error).toBe("Invalid or expired token");
  });

  it("passes with valid token and sets userId", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/test/protected",
      headers: { authorization: `Bearer ${validToken}` },
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();
    expect(body.userId).toBe(testUserId);
  });
});

// ── requireRole tests ───────────────────────────────────────────────

describe("requireRole", () => {
  it("passes when user has a matching role (admin)", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/test/admin/${testCourseId}`,
      headers: { authorization: `Bearer ${validToken}` },
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();
    expect(body.ok).toBe(true);
  });

  it("returns 403 when user has a role but not the required one", async () => {
    // User has "admin" but route requires "marshal"
    const response = await app.inject({
      method: "GET",
      url: `/test/marshal/${testCourseId}`,
      headers: { authorization: `Bearer ${validToken}` },
    });

    expect(response.statusCode).toBe(403);

    const body = response.json();
    expect(body.error).toBe("Insufficient permissions");
  });

  it("returns 403 when user has no role on the course", async () => {
    // Create a second user with no role
    const [noRoleUser] = await db
      .insert(users)
      .values({
        email: "norole@test.middleware",
        displayName: "No Role User",
        passwordHash: "$2b$12$placeholder.hash.for.testing.only",
      })
      .returning({ id: users.id });

    const noRoleToken = generateAccessToken(noRoleUser!.id);

    const response = await app.inject({
      method: "GET",
      url: `/test/admin/${testCourseId}`,
      headers: { authorization: `Bearer ${noRoleToken}` },
    });

    expect(response.statusCode).toBe(403);

    const body = response.json();
    expect(body.error).toBe("Insufficient permissions");
  });

  it("returns 401 when verifyToken has not run (no userId)", async () => {
    // Build a separate app with only requireRole (no verifyToken)
    const bareApp = await buildApp();
    bareApp.get("/test/no-auth/:courseId", { preHandler: [requireRole("owner")] }, async () => {
      return { ok: true };
    });
    await bareApp.ready();

    const response = await bareApp.inject({
      method: "GET",
      url: `/test/no-auth/${testCourseId}`,
    });

    expect(response.statusCode).toBe(401);

    const body = response.json();
    expect(body.error).toBe("Authentication required");

    await bareApp.close();
  });
});
