import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useSocket } from "../use-socket";

// ── Mock SocketClient ─────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const handlers = new Map<string, (...args: any[]) => void>();

const mockClient = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  joinRoom: vi.fn(),
  leaveRoom: vi.fn(),
  sendPosition: vi.fn(),
  refreshAuth: vi.fn(),
  destroy: vi.fn(),
  connected: false,
  onConnect: vi.fn((cb: () => void) => handlers.set("connect", cb)),
  onDisconnect: vi.fn((cb: () => void) => handlers.set("disconnect", cb)),
  onError: vi.fn((cb: (err: { message: string }) => void) => handlers.set("error", cb)),
  onPositionBroadcast: vi.fn(),
  onAuthRefreshed: vi.fn(),
};

vi.mock("../../services/socket-client", () => ({
  SocketClient: vi.fn(() => mockClient),
}));

// ── Mock auth store ───────────────────────────────────────────────

let mockAccessToken: string | null = "test-token";

vi.mock("../../stores/auth-store", () => ({
  useAuthStore: vi.fn((selector: (s: { accessToken: string | null }) => unknown) =>
    selector({ accessToken: mockAccessToken }),
  ),
}));

// ── Mock useGeolocation ───────────────────────────────────────────

const mockPosition = { lat: 44.885, lng: -0.564, accuracy: 5 };
let currentPosition: typeof mockPosition | null = mockPosition;

vi.mock("../use-geolocation", () => ({
  useGeolocation: vi.fn(() => ({
    position: currentPosition,
    error: null,
    watching: true,
    startWatching: vi.fn(),
    stopWatching: vi.fn(),
  })),
}));

// ── Mock constants ────────────────────────────────────────────────

vi.mock("../../lib/constants", () => ({
  WS_URL: "wss://test.api",
}));

// ── Tests ─────────────────────────────────────────────────────────

describe("useSocket", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    handlers.clear();
    mockClient.connected = false;
    mockAccessToken = "test-token";
    currentPosition = mockPosition;
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("does not connect when sessionId is null", () => {
    renderHook(() => useSocket(null, "course-1"));
    expect(mockClient.connect).not.toHaveBeenCalled();
  });

  it("does not connect when courseId is null", () => {
    renderHook(() => useSocket("session-1", null));
    expect(mockClient.connect).not.toHaveBeenCalled();
  });

  it("does not connect when accessToken is null", () => {
    mockAccessToken = null;
    renderHook(() => useSocket("session-1", "course-1"));
    expect(mockClient.connect).not.toHaveBeenCalled();
  });

  it("connects when sessionId, courseId, and token are provided", () => {
    renderHook(() => useSocket("session-1", "course-1"));

    expect(mockClient.connect).toHaveBeenCalledWith({
      url: "wss://test.api",
      token: "test-token",
    });
  });

  it("joins room and sets connected on connect event", () => {
    const { result } = renderHook(() => useSocket("session-1", "course-1"));

    expect(result.current.connected).toBe(false);

    act(() => {
      mockClient.connected = true;
      handlers.get("connect")?.();
    });

    expect(result.current.connected).toBe(true);
    expect(mockClient.joinRoom).toHaveBeenCalledWith("course-1");
  });

  it("sends position every 5 seconds after connect", () => {
    renderHook(() => useSocket("session-1", "course-1"));

    act(() => {
      mockClient.connected = true;
      handlers.get("connect")?.();
    });

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(mockClient.sendPosition).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: "session-1",
        lat: 44.885,
        lng: -0.564,
        accuracy: 5,
      }),
    );
  });

  it("does not send position when position is null", () => {
    currentPosition = null;
    renderHook(() => useSocket("session-1", "course-1"));

    act(() => {
      mockClient.connected = true;
      handlers.get("connect")?.();
    });

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(mockClient.sendPosition).not.toHaveBeenCalled();
  });

  it("clears interval on disconnect", () => {
    renderHook(() => useSocket("session-1", "course-1"));

    act(() => {
      mockClient.connected = true;
      handlers.get("connect")?.();
    });

    act(() => {
      mockClient.connected = false;
      handlers.get("disconnect")?.("transport close");
    });

    // Advance timer — should NOT send position since disconnected
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    // sendPosition should not have been called after disconnect
    expect(mockClient.sendPosition).not.toHaveBeenCalled();
  });

  it("sets error on error event", () => {
    const { result } = renderHook(() => useSocket("session-1", "course-1"));

    act(() => {
      handlers.get("error")?.({ message: "Session not found" });
    });

    expect(result.current.error).toBe("Session not found");
  });

  it("cleans up on unmount", () => {
    const { unmount } = renderHook(() => useSocket("session-1", "course-1"));

    unmount();

    expect(mockClient.leaveRoom).toHaveBeenCalledWith("course-1");
    expect(mockClient.destroy).toHaveBeenCalled();
  });

  it("cleans up and reconnects when sessionId changes", () => {
    const { rerender } = renderHook(({ sessionId, courseId }) => useSocket(sessionId, courseId), {
      initialProps: { sessionId: "s1", courseId: "c1" },
    });

    rerender({ sessionId: "s2", courseId: "c1" });

    // First instance cleaned up
    expect(mockClient.leaveRoom).toHaveBeenCalledWith("c1");
    expect(mockClient.destroy).toHaveBeenCalled();
    // Second connect issued
    expect(mockClient.connect).toHaveBeenCalledTimes(2);
  });
});
