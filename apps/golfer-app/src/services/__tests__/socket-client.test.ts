import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SOCKET_EVENTS } from "@golfix/shared";
import type { PositionUpdate, SocketError, PositionBroadcast } from "@golfix/shared";
import { SocketClient } from "../socket-client";

// ── Mock socket.io-client ─────────────────────────────────────────

const mockSocket = {
  connected: true,
  on: vi.fn(),
  emit: vi.fn(),
  disconnect: vi.fn(),
  removeAllListeners: vi.fn(),
};

vi.mock("socket.io-client", () => ({
  io: vi.fn(() => mockSocket),
}));

describe("SocketClient", () => {
  let client: SocketClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSocket.connected = true;
    client = new SocketClient();
  });

  afterEach(() => {
    client.destroy();
  });

  it("connects with auth token and websocket transport", async () => {
    const { io } = await import("socket.io-client");
    client.connect({ url: "https://api.test", token: "jwt-token" });

    expect(io).toHaveBeenCalledWith("https://api.test", {
      auth: { token: "jwt-token" },
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
  });

  it("disconnects previous socket when reconnecting", async () => {
    client.connect({ url: "https://api.test", token: "token-1" });
    client.connect({ url: "https://api.test", token: "token-2" });

    expect(mockSocket.disconnect).toHaveBeenCalledOnce();
  });

  it("reports connected status from socket", () => {
    expect(client.connected).toBe(false);

    client.connect({ url: "https://api.test", token: "jwt-token" });
    expect(client.connected).toBe(true);

    mockSocket.connected = false;
    expect(client.connected).toBe(false);
  });

  it("joins room with correct format", () => {
    client.connect({ url: "https://api.test", token: "jwt-token" });
    const courseId = "550e8400-e29b-41d4-a716-446655440000";
    client.joinRoom(courseId);

    expect(mockSocket.emit).toHaveBeenCalledWith(
      SOCKET_EVENTS.ROOM_JOIN,
      `course:${courseId}:positions`,
    );
  });

  it("leaves room with correct format", () => {
    client.connect({ url: "https://api.test", token: "jwt-token" });
    const courseId = "550e8400-e29b-41d4-a716-446655440000";
    client.leaveRoom(courseId);

    expect(mockSocket.emit).toHaveBeenCalledWith(
      SOCKET_EVENTS.ROOM_LEAVE,
      `course:${courseId}:positions`,
    );
  });

  it("sends position when connected", () => {
    client.connect({ url: "https://api.test", token: "jwt-token" });

    const position: PositionUpdate = {
      sessionId: "s1",
      lat: 44.885,
      lng: -0.564,
      accuracy: 5,
      recordedAt: "2026-02-19T10:00:00.000Z",
    };

    client.sendPosition(position);

    expect(mockSocket.emit).toHaveBeenCalledWith(SOCKET_EVENTS.POSITION_UPDATE, position);
  });

  it("guards sendPosition against disconnected state", () => {
    client.connect({ url: "https://api.test", token: "jwt-token" });
    mockSocket.connected = false;

    client.sendPosition({
      sessionId: "s1",
      lat: 44.885,
      lng: -0.564,
      accuracy: 5,
      recordedAt: "2026-02-19T10:00:00.000Z",
    });

    expect(mockSocket.emit).not.toHaveBeenCalledWith(
      SOCKET_EVENTS.POSITION_UPDATE,
      expect.anything(),
    );
  });

  it("refreshes auth token", () => {
    client.connect({ url: "https://api.test", token: "jwt-token" });
    client.refreshAuth("new-token");

    expect(mockSocket.emit).toHaveBeenCalledWith(SOCKET_EVENTS.AUTH_REFRESH, "new-token");
  });

  it("registers event handlers", () => {
    client.connect({ url: "https://api.test", token: "jwt-token" });

    const onConnect = vi.fn();
    const onDisconnect = vi.fn();
    const onError = vi.fn<(err: SocketError) => void>();
    const onBroadcast = vi.fn<(data: PositionBroadcast) => void>();
    const onAuthRefreshed = vi.fn();

    client.onConnect(onConnect);
    client.onDisconnect(onDisconnect);
    client.onError(onError);
    client.onPositionBroadcast(onBroadcast);
    client.onAuthRefreshed(onAuthRefreshed);

    expect(mockSocket.on).toHaveBeenCalledWith("connect", onConnect);
    expect(mockSocket.on).toHaveBeenCalledWith("disconnect", onDisconnect);
    expect(mockSocket.on).toHaveBeenCalledWith(SOCKET_EVENTS.ERROR, onError);
    expect(mockSocket.on).toHaveBeenCalledWith(SOCKET_EVENTS.POSITION_BROADCAST, onBroadcast);
    expect(mockSocket.on).toHaveBeenCalledWith(SOCKET_EVENTS.AUTH_REFRESHED, onAuthRefreshed);
  });

  it("destroy removes all listeners and disconnects", () => {
    client.connect({ url: "https://api.test", token: "jwt-token" });
    client.destroy();

    expect(mockSocket.removeAllListeners).toHaveBeenCalled();
    expect(mockSocket.disconnect).toHaveBeenCalled();
    expect(client.connected).toBe(false);
  });

  it("disconnect calls socket.disconnect", () => {
    client.connect({ url: "https://api.test", token: "jwt-token" });
    client.disconnect();

    expect(mockSocket.disconnect).toHaveBeenCalled();
  });
});
