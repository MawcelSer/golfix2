import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { sql, eq } from "drizzle-orm";
import { io as createClient, type Socket as ClientSocket } from "socket.io-client";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../app";
import { db } from "../../db/connection";
import { users, sessions, courses, positions } from "../../db/schema/index";
import { generateAccessToken } from "../../auth/auth-service";

// ── Test state ────────────────────────────────────────────────────

let app: FastifyInstance;
let serverUrl: string;
let testUserId: string;
let testCourseId: string;
let testSessionId: string;
let validToken: string;

// ── Helper: create connected client ──────────────────────────────

function connectClient(token: string): ClientSocket {
  return createClient(serverUrl, {
    auth: { token },
    transports: ["websocket"],
    forceNew: true,
  });
}

function waitForEvent<T>(
  socket: ClientSocket,
  event: string,
  timeoutMs = 3000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timed out waiting for event: ${event}`));
    }, timeoutMs);

    socket.once(event, (data: T) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

function waitForConnect(socket: ClientSocket, timeoutMs = 3000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (socket.connected) {
      resolve();
      return;
    }
    const timer = setTimeout(() => {
      reject(new Error("Timed out waiting for connection"));
    }, timeoutMs);

    socket.once("connect", () => {
      clearTimeout(timer);
      resolve();
    });

    socket.once("connect_error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

// ── Setup & Teardown ─────────────────────────────────────────────

async function cleanTestData(): Promise<void> {
  await db.execute(sql`
    DELETE FROM positions
    WHERE session_id IN (
      SELECT id FROM sessions
      WHERE user_id IN (
        SELECT id FROM users WHERE device_id LIKE 'ws-test-%'
      )
    )
  `);
  await db.execute(sql`
    DELETE FROM sessions
    WHERE user_id IN (
      SELECT id FROM users WHERE device_id LIKE 'ws-test-%'
    )
  `);
  await db.execute(sql`
    DELETE FROM refresh_tokens
    WHERE user_id IN (
      SELECT id FROM users WHERE device_id LIKE 'ws-test-%'
    )
  `);
  await db.execute(sql`DELETE FROM users WHERE device_id LIKE 'ws-test-%'`);
}

beforeAll(async () => {
  await cleanTestData();

  // Fetch seed course
  const courseRows = await db.execute<{ id: string }>(sql`
    SELECT id FROM courses WHERE slug = 'bordeaux-lac-test' LIMIT 1
  `);
  expect(courseRows[0]).toBeDefined();
  testCourseId = courseRows[0]!.id;

  // Create test user
  const [user] = await db
    .insert(users)
    .values({
      displayName: "WS Test User",
      deviceId: `ws-test-${Date.now()}`,
    })
    .returning({ id: users.id });
  testUserId = user!.id;
  validToken = generateAccessToken(testUserId);

  // Create test session
  const [session] = await db
    .insert(sessions)
    .values({
      userId: testUserId,
      courseId: testCourseId,
      startedAt: new Date(),
      status: "active",
    })
    .returning({ id: sessions.id });
  testSessionId = session!.id;

  // Build and start the Fastify app on a random port
  app = await buildApp();
  const address = await app.listen({ port: 0, host: "127.0.0.1" });
  serverUrl = address;
}, 15000);

afterAll(async () => {
  await cleanTestData();
  await app.close();
}, 10000);

// ── Auth tests ───────────────────────────────────────────────────

describe("Socket.io auth", () => {
  let client: ClientSocket;

  afterEach(() => {
    if (client?.connected) {
      client.disconnect();
    }
  });

  it("connects successfully with a valid token", async () => {
    client = connectClient(validToken);
    await waitForConnect(client);

    expect(client.connected).toBe(true);
  });

  it("rejects connection without a token", async () => {
    client = createClient(serverUrl, {
      transports: ["websocket"],
      forceNew: true,
    });

    await expect(waitForConnect(client)).rejects.toThrow();
    expect(client.connected).toBe(false);
  });

  it("rejects connection with an invalid token", async () => {
    client = connectClient("invalid-jwt-token");

    await expect(waitForConnect(client)).rejects.toThrow();
    expect(client.connected).toBe(false);
  });
});

// ── Room tests ───────────────────────────────────────────────────

describe("Socket.io rooms", () => {
  let client: ClientSocket;

  afterEach(() => {
    if (client?.connected) {
      client.disconnect();
    }
  });

  it("joins a valid room", async () => {
    client = connectClient(validToken);
    await waitForConnect(client);

    const room = `course:${testCourseId}:dashboard`;
    client.emit("room:join", room);

    // Give server time to process
    await new Promise((r) => setTimeout(r, 100));

    // If no error emitted, the join was successful
    expect(client.connected).toBe(true);
  });

  it("emits error for invalid room format", async () => {
    client = connectClient(validToken);
    await waitForConnect(client);

    const errorPromise = waitForEvent<{ message: string }>(client, "error");
    client.emit("room:join", "invalid-room");

    const error = await errorPromise;
    expect(error.message).toBe("Invalid room format");
  });

  it("emits error for invalid room:leave format", async () => {
    client = connectClient(validToken);
    await waitForConnect(client);

    const errorPromise = waitForEvent<{ message: string }>(client, "error");
    client.emit("room:leave", "invalid-room");

    const error = await errorPromise;
    expect(error.message).toBe("Invalid room format");
  });
});

// ── Auth refresh tests ───────────────────────────────────────────

describe("Socket.io auth:refresh", () => {
  let client: ClientSocket;

  afterEach(() => {
    if (client?.connected) {
      client.disconnect();
    }
  });

  it("refreshes auth context with valid token", async () => {
    client = connectClient(validToken);
    await waitForConnect(client);

    const newToken = generateAccessToken(testUserId);
    const refreshedPromise = waitForEvent(client, "auth:refreshed");
    client.emit("auth:refresh", newToken);

    await refreshedPromise;
    // If we get here, the refresh was successful
    expect(client.connected).toBe(true);
  });

  it("emits error for invalid refresh token", async () => {
    client = connectClient(validToken);
    await waitForConnect(client);

    const errorPromise = waitForEvent<{ message: string }>(client, "error");
    client.emit("auth:refresh", "bad-token");

    const error = await errorPromise;
    expect(error.message).toBe("Invalid or expired token");
  });
});

// ── Position handler tests ───────────────────────────────────────

describe("position:update", () => {
  let client: ClientSocket;
  let dashboardClient: ClientSocket;

  afterEach(() => {
    if (client?.connected) client.disconnect();
    if (dashboardClient?.connected) dashboardClient.disconnect();
  });

  it("rejects invalid position data", async () => {
    client = connectClient(validToken);
    await waitForConnect(client);

    const errorPromise = waitForEvent<{ message: string }>(client, "error");
    client.emit("position:update", { bad: "data" });

    const error = await errorPromise;
    expect(error.message).toContain("Invalid position data");
  });

  it("rejects position for non-owned session", async () => {
    // Create a second user
    const [otherUser] = await db
      .insert(users)
      .values({
        displayName: "WS Other User",
        deviceId: `ws-test-other-${Date.now()}`,
      })
      .returning({ id: users.id });

    const otherToken = generateAccessToken(otherUser!.id);
    client = connectClient(otherToken);
    await waitForConnect(client);

    const errorPromise = waitForEvent<{ message: string }>(client, "error");
    client.emit("position:update", {
      sessionId: testSessionId,
      lat: 44.838,
      lng: -0.579,
      accuracy: 5,
      recordedAt: new Date().toISOString(),
    });

    const error = await errorPromise;
    expect(error.message).toBe("Session not found or not active");
  });

  it("accepts valid position and broadcasts to dashboard", async () => {
    // Connect dashboard client and join the course dashboard room
    dashboardClient = connectClient(validToken);
    await waitForConnect(dashboardClient);
    dashboardClient.emit("room:join", `course:${testCourseId}:dashboard`);

    // Give server time to join room
    await new Promise((r) => setTimeout(r, 100));

    // Connect golfer client
    client = connectClient(validToken);
    await waitForConnect(client);

    const broadcastPromise = waitForEvent<{
      sessionId: string;
      lat: number;
      lng: number;
      accuracy: number;
      holeNumber: number | null;
      recordedAt: string;
    }>(dashboardClient, "position:broadcast");

    const recordedAt = new Date().toISOString();
    client.emit("position:update", {
      sessionId: testSessionId,
      lat: 44.838,
      lng: -0.579,
      accuracy: 5,
      recordedAt,
    });

    const broadcast = await broadcastPromise;

    expect(broadcast.sessionId).toBe(testSessionId);
    expect(broadcast.lat).toBe(44.838);
    expect(broadcast.lng).toBe(-0.579);
    expect(broadcast.accuracy).toBe(5);
    expect(broadcast.recordedAt).toBe(recordedAt);
  });

  it("rejects position with lat out of range", async () => {
    client = connectClient(validToken);
    await waitForConnect(client);

    const errorPromise = waitForEvent<{ message: string }>(client, "error");
    client.emit("position:update", {
      sessionId: testSessionId,
      lat: 91,
      lng: -0.579,
      accuracy: 5,
      recordedAt: new Date().toISOString(),
    });

    const error = await errorPromise;
    expect(error.message).toContain("Invalid position data");
  });

  it("rejects position with negative accuracy", async () => {
    client = connectClient(validToken);
    await waitForConnect(client);

    const errorPromise = waitForEvent<{ message: string }>(client, "error");
    client.emit("position:update", {
      sessionId: testSessionId,
      lat: 44.838,
      lng: -0.579,
      accuracy: -1,
      recordedAt: new Date().toISOString(),
    });

    const error = await errorPromise;
    expect(error.message).toContain("Invalid position data");
  });

  it("rejects position with invalid sessionId format", async () => {
    client = connectClient(validToken);
    await waitForConnect(client);

    const errorPromise = waitForEvent<{ message: string }>(client, "error");
    client.emit("position:update", {
      sessionId: "not-a-uuid",
      lat: 44.838,
      lng: -0.579,
      accuracy: 5,
      recordedAt: new Date().toISOString(),
    });

    const error = await errorPromise;
    expect(error.message).toContain("Invalid position data");
  });
});
