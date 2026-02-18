import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { sql } from "drizzle-orm";
import { buildApp } from "../../app";
import { db } from "../../db/connection";

const AUTH_BASE = "/api/v1/auth";
const ROUNDS_BASE = "/api/v1/users/me/rounds";

// ── Helpers ─────────────────────────────────────────────────────────

async function registerAndGetTokens(
  app: Awaited<ReturnType<typeof buildApp>>,
  email: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  const response = await app.inject({
    method: "POST",
    url: `${AUTH_BASE}/register`,
    payload: {
      email,
      password: "secure-pass-123",
      displayName: "Integration Tester",
    },
  });

  const body = response.json();
  return {
    accessToken: body.accessToken as string,
    refreshToken: body.refreshToken as string,
  };
}

// ── Cleanup ─────────────────────────────────────────────────────────

async function cleanTestData(): Promise<void> {
  await db.execute(sql`
    DELETE FROM refresh_tokens
    WHERE user_id IN (
      SELECT id FROM users
      WHERE email LIKE '%@test-integration.golfix.dev'
        OR device_id LIKE 'integ-device-%'
    )
  `);

  await db.execute(sql`
    DELETE FROM sessions
    WHERE user_id IN (
      SELECT id FROM users
      WHERE email LIKE '%@test-integration.golfix.dev'
        OR device_id LIKE 'integ-device-%'
    )
  `);

  await db.execute(sql`
    DELETE FROM users
    WHERE email LIKE '%@test-integration.golfix.dev'
      OR device_id LIKE 'integ-device-%'
  `);
}

// ── Tests ────────────────────────────────────────────────────────────

describe("Auth integration tests", () => {
  beforeAll(async () => {
    await cleanTestData();
  });

  afterAll(async () => {
    await cleanTestData();
  });

  // ── Register → login → access protected route ────────────────────

  it("register → login → access protected route → success", async () => {
    const app = await buildApp();

    // Register
    const registerRes = await app.inject({
      method: "POST",
      url: `${AUTH_BASE}/register`,
      payload: {
        email: "flow-register-login@test-integration.golfix.dev",
        password: "secure-pass-123",
        displayName: "Flow Tester",
      },
    });

    expect(registerRes.statusCode).toBe(201);
    const registerBody = registerRes.json();
    expect(registerBody.accessToken).toBeDefined();

    // Login with same credentials
    const loginRes = await app.inject({
      method: "POST",
      url: `${AUTH_BASE}/login`,
      payload: {
        email: "flow-register-login@test-integration.golfix.dev",
        password: "secure-pass-123",
      },
    });

    expect(loginRes.statusCode).toBe(200);
    const loginBody = loginRes.json();
    expect(loginBody.accessToken).toBeDefined();
    expect(loginBody.refreshToken).toBeDefined();

    // Access protected route with access token from login
    const roundsRes = await app.inject({
      method: "GET",
      url: ROUNDS_BASE,
      headers: { authorization: `Bearer ${loginBody.accessToken}` },
    });

    expect(roundsRes.statusCode).toBe(200);

    await app.close();
  });

  // ── Register → refresh → new tokens work ────────────────────────

  it("register → get tokens → refresh → new tokens work on protected route", async () => {
    const app = await buildApp();

    const { accessToken: _initial, refreshToken } = await registerAndGetTokens(
      app,
      "flow-refresh@test-integration.golfix.dev",
    );

    // Refresh
    const refreshRes = await app.inject({
      method: "POST",
      url: `${AUTH_BASE}/refresh`,
      payload: { refreshToken },
    });

    expect(refreshRes.statusCode).toBe(200);
    const refreshBody = refreshRes.json();
    expect(refreshBody.accessToken).toBeDefined();
    expect(refreshBody.refreshToken).toBeDefined();
    // Ensure new tokens are distinct from originals
    expect(refreshBody.refreshToken).not.toBe(refreshToken);

    // Use the new access token on the protected route
    const roundsRes = await app.inject({
      method: "GET",
      url: ROUNDS_BASE,
      headers: { authorization: `Bearer ${refreshBody.accessToken}` },
    });

    expect(roundsRes.statusCode).toBe(200);

    await app.close();
  });

  // ── Register → logout → refresh with old token → 401 ────────────

  it("register → logout → refresh with old token → 401", async () => {
    const app = await buildApp();

    const { refreshToken } = await registerAndGetTokens(
      app,
      "flow-logout@test-integration.golfix.dev",
    );

    // Logout
    const logoutRes = await app.inject({
      method: "POST",
      url: `${AUTH_BASE}/logout`,
      payload: { refreshToken },
    });

    expect(logoutRes.statusCode).toBe(200);
    expect(logoutRes.json().message).toBe("Logged out");

    // Attempt to refresh with the now-revoked token
    const refreshRes = await app.inject({
      method: "POST",
      url: `${AUTH_BASE}/refresh`,
      payload: { refreshToken },
    });

    expect(refreshRes.statusCode).toBe(401);

    await app.close();
  });

  // ── Anonymous register → access protected route → success ────────

  it("anonymous register → access protected route → success", async () => {
    const app = await buildApp();

    const anonRes = await app.inject({
      method: "POST",
      url: `${AUTH_BASE}/anonymous`,
      payload: {
        deviceId: "integ-device-anon001",
        displayName: "Anon Integration",
      },
    });

    expect(anonRes.statusCode).toBe(201);
    const anonBody = anonRes.json();
    expect(anonBody.accessToken).toBeDefined();
    expect(anonBody.user.email).toBeNull();

    // Access protected route using anonymous access token
    const roundsRes = await app.inject({
      method: "GET",
      url: ROUNDS_BASE,
      headers: { authorization: `Bearer ${anonBody.accessToken}` },
    });

    expect(roundsRes.statusCode).toBe(200);

    await app.close();
  });

  // ── Rate limiting: 11 requests in quick succession → 429 ─────────

  it("rate limiting: 11 auth requests in quick succession → 429", async () => {
    // Use a fresh app instance to avoid interference with prior test rate counters
    const app = await buildApp();

    const email = "rl-victim@test-integration.golfix.dev";

    // First, register the user so all login attempts hit the auth logic
    await app.inject({
      method: "POST",
      url: `${AUTH_BASE}/register`,
      payload: {
        email,
        password: "secure-pass-123",
        displayName: "Rate Limit Victim",
      },
    });

    // Send 11 login requests — the 11th should be rate-limited (max: 10)
    const requests = Array.from({ length: 11 }, () =>
      app.inject({
        method: "POST",
        url: `${AUTH_BASE}/login`,
        payload: { email, password: "secure-pass-123" },
      }),
    );

    const responses = await Promise.all(requests);
    const statusCodes = responses.map((r) => r.statusCode);

    // At least one request must have received 429
    expect(statusCodes).toContain(429);

    await app.close();
  });
});
