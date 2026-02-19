import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../app";
import { db } from "../../db/connection";
import { users } from "../../db/schema/core";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-me";
const BASE = "/api/v1";

function makeToken(userId: string): string {
  return jwt.sign({ sub: userId, type: "access" }, JWT_SECRET, { expiresIn: "15m" });
}

describe("User preference routes", () => {
  let app: FastifyInstance;
  let userId: string;
  let token: string;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Create a test user
    const [user] = await db
      .insert(users)
      .values({
        displayName: "Test Prefs User",
        email: `prefs-${Date.now()}@test.com`,
        passwordHash: "unused",
      })
      .returning({ id: users.id });
    userId = user!.id;
    token = makeToken(userId);
  });

  describe("GET /users/me/preferences", () => {
    it("returns default preferences for new user", async () => {
      const res = await app.inject({
        method: "GET",
        url: `${BASE}/users/me/preferences`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.notificationPrefs).toEqual({ pace_reminders: true });
    });

    it("returns 401 without token", async () => {
      const res = await app.inject({
        method: "GET",
        url: `${BASE}/users/me/preferences`,
      });

      expect(res.statusCode).toBe(401);
    });
  });

  describe("PATCH /users/me/preferences", () => {
    it("updates pace reminders to false", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: `${BASE}/users/me/preferences`,
        headers: { authorization: `Bearer ${token}` },
        payload: { paceReminders: false },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.notificationPrefs).toEqual({ pace_reminders: false });
    });

    it("persists preference change", async () => {
      // Update
      await app.inject({
        method: "PATCH",
        url: `${BASE}/users/me/preferences`,
        headers: { authorization: `Bearer ${token}` },
        payload: { paceReminders: false },
      });

      // Read back
      const res = await app.inject({
        method: "GET",
        url: `${BASE}/users/me/preferences`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.json().notificationPrefs).toEqual({ pace_reminders: false });
    });

    it("rejects invalid payload", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: `${BASE}/users/me/preferences`,
        headers: { authorization: `Bearer ${token}` },
        payload: { paceReminders: "not-a-boolean" },
      });

      expect(res.statusCode).toBe(400);
    });

    it("returns 401 without token", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: `${BASE}/users/me/preferences`,
        payload: { paceReminders: false },
      });

      expect(res.statusCode).toBe(401);
    });
  });
});
