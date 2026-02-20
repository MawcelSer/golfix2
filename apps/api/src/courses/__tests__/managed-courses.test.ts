import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { sql } from "drizzle-orm";
import { buildApp } from "../../app";
import { db } from "../../db/connection";
import { courses, courseRoles, users } from "../../db/schema/index";
import { eq } from "drizzle-orm";

const BASE = "/api/v1/courses";
const AUTH_BASE = "/api/v1/auth";

const TEST_EMAIL = "managed-test@test-managed.golfix";

// ── Helpers ─────────────────────────────────────────────────────────

async function registerAndGetToken(
  app: Awaited<ReturnType<typeof buildApp>>,
  email: string,
): Promise<{ accessToken: string; userId: string }> {
  const response = await app.inject({
    method: "POST",
    url: `${AUTH_BASE}/register`,
    payload: {
      email,
      password: "secure-pass-123",
      displayName: "Managed Test User",
    },
  });

  const body = response.json();
  return { accessToken: body.accessToken as string, userId: body.user.id as string };
}

// ── Cleanup ─────────────────────────────────────────────────────────

async function cleanTestData(): Promise<void> {
  await db.execute(sql`
    DELETE FROM course_roles
    WHERE user_id IN (
      SELECT id FROM users WHERE email LIKE '%@test-managed.golfix%'
    )
  `);
  await db.execute(sql`
    DELETE FROM refresh_tokens
    WHERE user_id IN (
      SELECT id FROM users WHERE email LIKE '%@test-managed.golfix%'
    )
  `);
  await db.execute(sql`
    DELETE FROM users WHERE email LIKE '%@test-managed.golfix%'
  `);
}

// ── Tests ───────────────────────────────────────────────────────────

describe("GET /courses/managed", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    await cleanTestData();
    app = await buildApp();
  });

  afterAll(async () => {
    await cleanTestData();
    await app.close();
  });

  it("returns 401 without auth", async () => {
    const response = await app.inject({ method: "GET", url: `${BASE}/managed` });
    expect(response.statusCode).toBe(401);
  });

  it("returns empty array when user has no roles", async () => {
    const { accessToken } = await registerAndGetToken(app, TEST_EMAIL);

    const response = await app.inject({
      method: "GET",
      url: `${BASE}/managed`,
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([]);
  });

  it("returns courses where user has a role", async () => {
    const userRows = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, TEST_EMAIL))
      .limit(1);
    const userId = userRows[0]!.id;

    // Get a seeded course
    const courseRows = await db.select({ id: courses.id }).from(courses).limit(1);
    const courseId = courseRows[0]!.id;

    // Assign role
    await db.insert(courseRoles).values({
      userId,
      courseId,
      role: "admin",
    });

    // Re-register to get fresh token (user already exists, so login)
    const loginResp = await app.inject({
      method: "POST",
      url: `${AUTH_BASE}/login`,
      payload: { email: TEST_EMAIL, password: "secure-pass-123" },
    });
    const { accessToken } = loginResp.json();

    const response = await app.inject({
      method: "GET",
      url: `${BASE}/managed`,
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({
      id: courseId,
      role: "admin",
    });
    expect(body[0]).toHaveProperty("name");
    expect(body[0]).toHaveProperty("slug");
    expect(body[0]).toHaveProperty("holesCount");
    expect(body[0]).toHaveProperty("par");
  });
});
