import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../app";
import { db } from "../../db/connection";
import { users, courseRoles } from "../../db/schema/core";
import { eq } from "drizzle-orm";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-me";
const BASE = "/api/v1";

function makeToken(userId: string): string {
  return jwt.sign({ sub: userId, type: "access" }, JWT_SECRET, { expiresIn: "15m" });
}

describe("PATCH /api/v1/courses/:courseId/settings", () => {
  let app: FastifyInstance;
  let courseId: string;
  let ownerUserId: string;
  let ownerToken: string;
  let viewerUserId: string;
  let viewerToken: string;

  beforeAll(async () => {
    app = await buildApp();

    // Get seed course
    const [course] = await db.execute<{ id: string }>(
      /*sql*/ `SELECT id FROM courses LIMIT 1`,
    );
    if (!course) throw new Error("No seed course — run pnpm db:seed");
    courseId = course.id;

    // Create owner user
    const [owner] = await db
      .insert(users)
      .values({
        displayName: "Settings Owner",
        email: `settings-owner-${Date.now()}@test.com`,
        passwordHash: "unused",
      })
      .returning({ id: users.id });
    if (!owner) throw new Error("Setup failed");
    ownerUserId = owner.id;
    ownerToken = makeToken(ownerUserId);

    // Assign owner role
    await db.insert(courseRoles).values({
      userId: ownerUserId,
      courseId,
      role: "owner",
    });

    // Create viewer user
    const [viewer] = await db
      .insert(users)
      .values({
        displayName: "Settings Viewer",
        email: `settings-viewer-${Date.now()}@test.com`,
        passwordHash: "unused",
      })
      .returning({ id: users.id });
    if (!viewer) throw new Error("Setup failed");
    viewerUserId = viewer.id;
    viewerToken = makeToken(viewerUserId);

    // Assign viewer role
    await db.insert(courseRoles).values({
      userId: viewerUserId,
      courseId,
      role: "viewer",
    });
  });

  afterAll(async () => {
    await db.delete(courseRoles).where(eq(courseRoles.userId, ownerUserId));
    await db.delete(courseRoles).where(eq(courseRoles.userId, viewerUserId));
    await db.delete(users).where(eq(users.id, ownerUserId));
    await db.delete(users).where(eq(users.id, viewerUserId));
    await app.close();
  });

  it("updates pace target for course owner", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `${BASE}/courses/${courseId}/settings`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { paceTargetMinutes: 240 },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.paceTargetMinutes).toBe(240);
  });

  it("returns 403 for viewer role", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `${BASE}/courses/${courseId}/settings`,
      headers: { authorization: `Bearer ${viewerToken}` },
      payload: { paceTargetMinutes: 240 },
    });

    expect(res.statusCode).toBe(403);
  });

  it("validates input (rejects negative pace target)", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `${BASE}/courses/${courseId}/settings`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { paceTargetMinutes: -5 },
    });

    expect(res.statusCode).toBe(400);
  });

  it("rejects empty payload", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `${BASE}/courses/${courseId}/settings`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {},
    });

    expect(res.statusCode).toBe(400);
  });

  it("returns 401 without token", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `${BASE}/courses/${courseId}/settings`,
      payload: { paceTargetMinutes: 240 },
    });

    expect(res.statusCode).toBe(401);
  });
});

describe("Role management endpoints", () => {
  let app: FastifyInstance;
  let courseId: string;
  let ownerUserId: string;
  let ownerToken: string;
  let targetUserId: string;

  beforeAll(async () => {
    app = await buildApp();

    const [course] = await db.execute<{ id: string }>(
      /*sql*/ `SELECT id FROM courses LIMIT 1`,
    );
    if (!course) throw new Error("No seed course");
    courseId = course.id;

    // Create owner
    const [owner] = await db
      .insert(users)
      .values({
        displayName: "Role Manager",
        email: `role-mgr-${Date.now()}@test.com`,
        passwordHash: "unused",
      })
      .returning({ id: users.id });
    if (!owner) throw new Error("Setup failed");
    ownerUserId = owner.id;
    ownerToken = makeToken(ownerUserId);

    await db.insert(courseRoles).values({
      userId: ownerUserId,
      courseId,
      role: "owner",
    });

    // Create target user for role assignment
    const [target] = await db
      .insert(users)
      .values({
        displayName: "Target User",
        email: `target-${Date.now()}@test.com`,
        passwordHash: "unused",
      })
      .returning({ id: users.id, email: users.email });
    if (!target) throw new Error("Setup failed");
    targetUserId = target.id;
  });

  afterAll(async () => {
    await db.delete(courseRoles).where(eq(courseRoles.userId, ownerUserId));
    await db.delete(courseRoles).where(eq(courseRoles.userId, targetUserId));
    await db.delete(users).where(eq(users.id, ownerUserId));
    await db.delete(users).where(eq(users.id, targetUserId));
    await app.close();
  });

  it("lists roles for course", async () => {
    const res = await app.inject({
      method: "GET",
      url: `${BASE}/courses/${courseId}/roles`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
  });

  it("assigns a role to a user by email", async () => {
    // Get target user's email
    const [target] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, targetUserId));

    const res = await app.inject({
      method: "POST",
      url: `${BASE}/courses/${courseId}/roles`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { email: target!.email, role: "admin" },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.role).toBe("admin");
    expect(body.userId).toBe(targetUserId);
  });

  it("returns 409 for duplicate role assignment", async () => {
    const [target] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, targetUserId));

    const res = await app.inject({
      method: "POST",
      url: `${BASE}/courses/${courseId}/roles`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { email: target!.email, role: "viewer" },
    });

    expect(res.statusCode).toBe(409);
  });

  it("removes a role", async () => {
    // Find the target's role ID
    const [role] = await db
      .select({ id: courseRoles.id })
      .from(courseRoles)
      .where(eq(courseRoles.userId, targetUserId));

    const res = await app.inject({
      method: "DELETE",
      url: `${BASE}/courses/${courseId}/roles/${role!.id}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });

    expect(res.statusCode).toBe(204);
  });
});
