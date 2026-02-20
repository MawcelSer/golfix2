import { describe, it, expect, vi, beforeEach } from "vitest";
import { DashboardSocketClient } from "../socket-client";

vi.mock("socket.io-client", () => {
  const mockSocket = {
    connected: false,
    emit: vi.fn(),
    on: vi.fn(),
    disconnect: vi.fn(),
    removeAllListeners: vi.fn(),
  };

  return {
    io: vi.fn(() => mockSocket),
    __mockSocket: mockSocket,
  };
});

import { io } from "socket.io-client";

function getSocket() {
  return (io as ReturnType<typeof vi.fn>).mock.results[0]?.value;
}

describe("DashboardSocketClient", () => {
  let client: DashboardSocketClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new DashboardSocketClient();
  });

  it("starts disconnected", () => {
    expect(client.connected).toBe(false);
  });

  it("connect calls io with correct options", () => {
    client.connect({ url: "http://localhost:3000", token: "test-token" });

    expect(io).toHaveBeenCalledWith("http://localhost:3000", {
      auth: { token: "test-token" },
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
  });

  it("joinDashboardRoom emits room:join with dashboard room", () => {
    client.connect({ url: "http://localhost:3000", token: "t" });
    client.joinDashboardRoom("course-123");

    const socket = getSocket();
    expect(socket.emit).toHaveBeenCalledWith("room:join", "course:course-123:dashboard");
  });

  it("leaveDashboardRoom emits room:leave with dashboard room", () => {
    client.connect({ url: "http://localhost:3000", token: "t" });
    client.leaveDashboardRoom("course-123");

    const socket = getSocket();
    expect(socket.emit).toHaveBeenCalledWith("room:leave", "course:course-123:dashboard");
  });

  it("onGroupsUpdate registers listener for groups:update", () => {
    client.connect({ url: "http://localhost:3000", token: "t" });
    const cb = vi.fn();
    client.onGroupsUpdate(cb);

    const socket = getSocket();
    expect(socket.on).toHaveBeenCalledWith("groups:update", cb);
  });

  it("onAlertNew registers listener for alert:new", () => {
    client.connect({ url: "http://localhost:3000", token: "t" });
    const cb = vi.fn();
    client.onAlertNew(cb);

    const socket = getSocket();
    expect(socket.on).toHaveBeenCalledWith("alert:new", cb);
  });

  it("onBottleneckUpdate registers listener for bottleneck:update", () => {
    client.connect({ url: "http://localhost:3000", token: "t" });
    const cb = vi.fn();
    client.onBottleneckUpdate(cb);

    const socket = getSocket();
    expect(socket.on).toHaveBeenCalledWith("bottleneck:update", cb);
  });

  it("destroy cleans up socket", () => {
    client.connect({ url: "http://localhost:3000", token: "t" });
    client.destroy();

    const socket = getSocket();
    expect(socket.removeAllListeners).toHaveBeenCalled();
    expect(socket.disconnect).toHaveBeenCalled();
  });
});
