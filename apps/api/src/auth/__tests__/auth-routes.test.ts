import { describe, it, expect, beforeEach } from "vitest";
import { sql } from "drizzle-orm";
import { buildApp } from "../../app";
import { db } from "../../db/connection";

const BASE = "/api/v1/auth";

// ── Cleanup ─────────────────────────────────────────────────────────

async function cleanTestData(): Promise<void> {
  const userFilter = sql`
    SELECT id FROM users
    WHERE email LIKE '%@test.golfix%' OR device_id LIKE 'test-%'
  `;

  // Delete in FK-dependency order
  await db.execute(sql`
    DELETE FROM positions WHERE session_id IN (
      SELECT id FROM sessions WHERE user_id IN (${userFilter})
    )
  `);
  await db.execute(sql`
    DELETE FROM scores WHERE round_id IN (
      SELECT id FROM rounds WHERE user_id IN (${userFilter})
    )
  `);
  await db.execute(sql`DELETE FROM rounds WHERE user_id IN (${userFilter})`);
  await db.execute(sql`DELETE FROM sessions WHERE user_id IN (${userFilter})`);
  await db.execute(sql`DELETE FROM refresh_tokens WHERE user_id IN (${userFilter})`);
  await db.execute(sql`
    DELETE FROM users
    WHERE email LIKE '%@test.golfix%' OR device_id LIKE 'test-%'
  `);
}

// ── Tests ───────────────────────────────────────────────────────────

describe("Auth routes", () => {
  beforeEach(async () => {
    await cleanTestData();
  });

  // ── POST /register ──────────────────────────────────────────────

  describe("POST /auth/register", () => {
    it("creates user and returns tokens (201)", async () => {
      const app = await buildApp();

      const response = await app.inject({
        method: "POST",
        url: `${BASE}/register`,
        payload: {
          email: "alice@test.golfix.dev",
          password: "secure-pass-123",
          displayName: "Alice",
        },
      });

      expect(response.statusCode).toBe(201);

      const body = response.json();
      expect(body.user.id).toBeDefined();
      expect(body.user.displayName).toBe("Alice");
      expect(body.user.email).toBe("alice@test.golfix.dev");
      expect(body.accessToken).toBeDefined();
      expect(body.refreshToken).toBeDefined();

      await app.close();
    });

    it("duplicate email returns 409", async () => {
      const app = await buildApp();

      // First registration
      await app.inject({
        method: "POST",
        url: `${BASE}/register`,
        payload: {
          email: "dup@test.golfix.dev",
          password: "secure-pass-123",
          displayName: "First",
        },
      });

      // Second registration with same email
      const response = await app.inject({
        method: "POST",
        url: `${BASE}/register`,
        payload: {
          email: "dup@test.golfix.dev",
          password: "other-pass-456",
          displayName: "Second",
        },
      });

      expect(response.statusCode).toBe(409);

      const body = response.json();
      expect(body.error).toBe("Email already registered");

      await app.close();
    });

    it("invalid email returns 400", async () => {
      const app = await buildApp();

      const response = await app.inject({
        method: "POST",
        url: `${BASE}/register`,
        payload: {
          email: "not-an-email",
          password: "secure-pass-123",
          displayName: "Bad",
        },
      });

      expect(response.statusCode).toBe(400);

      const body = response.json();
      expect(body.error).toBeDefined();

      await app.close();
    });
  });

  // ── POST /login ─────────────────────────────────────────────────

  describe("POST /auth/login", () => {
    it("valid credentials return tokens (200)", async () => {
      const app = await buildApp();

      // Register first
      await app.inject({
        method: "POST",
        url: `${BASE}/register`,
        payload: {
          email: "login@test.golfix.dev",
          password: "secure-pass-123",
          displayName: "Loginable",
        },
      });

      // Login
      const response = await app.inject({
        method: "POST",
        url: `${BASE}/login`,
        payload: {
          email: "login@test.golfix.dev",
          password: "secure-pass-123",
        },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.user.email).toBe("login@test.golfix.dev");
      expect(body.accessToken).toBeDefined();
      expect(body.refreshToken).toBeDefined();

      await app.close();
    });

    it("wrong password returns 401", async () => {
      const app = await buildApp();

      // Register first
      await app.inject({
        method: "POST",
        url: `${BASE}/register`,
        payload: {
          email: "wrongpw@test.golfix.dev",
          password: "secure-pass-123",
          displayName: "WrongPw",
        },
      });

      const response = await app.inject({
        method: "POST",
        url: `${BASE}/login`,
        payload: {
          email: "wrongpw@test.golfix.dev",
          password: "wrong-password",
        },
      });

      expect(response.statusCode).toBe(401);

      const body = response.json();
      expect(body.error).toBe("Invalid credentials");

      await app.close();
    });

    it("unknown email returns 401", async () => {
      const app = await buildApp();

      const response = await app.inject({
        method: "POST",
        url: `${BASE}/login`,
        payload: {
          email: "nobody@test.golfix.dev",
          password: "some-password",
        },
      });

      expect(response.statusCode).toBe(401);

      const body = response.json();
      expect(body.error).toBe("Invalid credentials");

      await app.close();
    });
  });

  // ── POST /anonymous ─────────────────────────────────────────────

  describe("POST /auth/anonymous", () => {
    it("creates user with deviceId (201)", async () => {
      const app = await buildApp();

      const response = await app.inject({
        method: "POST",
        url: `${BASE}/anonymous`,
        payload: {
          displayName: "AnonGolfer",
          deviceId: "test-device-abc123",
        },
      });

      expect(response.statusCode).toBe(201);

      const body = response.json();
      expect(body.user.id).toBeDefined();
      expect(body.user.displayName).toBe("AnonGolfer");
      expect(body.user.email).toBeNull();
      expect(body.accessToken).toBeDefined();
      expect(body.refreshToken).toBeDefined();

      await app.close();
    });

    it("invalid deviceId format returns 400", async () => {
      const app = await buildApp();

      const response = await app.inject({
        method: "POST",
        url: `${BASE}/anonymous`,
        payload: {
          displayName: "AnonGolfer",
          deviceId: "bad id!@#",
        },
      });

      expect(response.statusCode).toBe(400);

      const body = response.json();
      expect(body.error).toBeDefined();

      await app.close();
    });
  });

  // ── POST /refresh ───────────────────────────────────────────────

  describe("POST /auth/refresh", () => {
    it("valid token returns new pair (200)", async () => {
      const app = await buildApp();

      // Register to get tokens
      const regResponse = await app.inject({
        method: "POST",
        url: `${BASE}/register`,
        payload: {
          email: "refresh@test.golfix.dev",
          password: "secure-pass-123",
          displayName: "Refresher",
        },
      });

      const regBody = regResponse.json();

      // Refresh
      const response = await app.inject({
        method: "POST",
        url: `${BASE}/refresh`,
        payload: {
          refreshToken: regBody.refreshToken,
        },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.accessToken).toBeDefined();
      expect(body.refreshToken).toBeDefined();
      // New tokens should be different from old
      expect(body.refreshToken).not.toBe(regBody.refreshToken);

      await app.close();
    });

    it("revoked token returns 401", async () => {
      const app = await buildApp();

      // Register to get tokens
      const regResponse = await app.inject({
        method: "POST",
        url: `${BASE}/register`,
        payload: {
          email: "revoked@test.golfix.dev",
          password: "secure-pass-123",
          displayName: "Revoked",
        },
      });

      const regBody = regResponse.json();

      // Logout (revokes the token)
      await app.inject({
        method: "POST",
        url: `${BASE}/logout`,
        payload: {
          refreshToken: regBody.refreshToken,
        },
      });

      // Try to refresh with revoked token
      const response = await app.inject({
        method: "POST",
        url: `${BASE}/refresh`,
        payload: {
          refreshToken: regBody.refreshToken,
        },
      });

      expect(response.statusCode).toBe(401);

      const body = response.json();
      expect(body.error).toBeDefined();

      await app.close();
    });
  });

  // ── POST /logout ────────────────────────────────────────────────

  describe("POST /auth/logout", () => {
    it("revokes refresh token (200)", async () => {
      const app = await buildApp();

      // Register to get tokens
      const regResponse = await app.inject({
        method: "POST",
        url: `${BASE}/register`,
        payload: {
          email: "logout@test.golfix.dev",
          password: "secure-pass-123",
          displayName: "Logouter",
        },
      });

      const regBody = regResponse.json();

      // Logout
      const response = await app.inject({
        method: "POST",
        url: `${BASE}/logout`,
        payload: {
          refreshToken: regBody.refreshToken,
        },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.message).toBe("Logged out");

      // Verify token is actually revoked — trying to refresh should fail
      const refreshResponse = await app.inject({
        method: "POST",
        url: `${BASE}/refresh`,
        payload: {
          refreshToken: regBody.refreshToken,
        },
      });

      expect(refreshResponse.statusCode).toBe(401);

      await app.close();
    });
  });
});
