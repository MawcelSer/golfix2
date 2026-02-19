import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import type { GpsPosition } from "../use-geolocation";

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

// ── Mock session store ────────────────────────────────────────────

let mockSessionId: string | null = "session-1";
let mockCourseId: string | null = "course-1";

vi.mock("../../stores/session-store", () => ({
  useSessionStore: vi.fn(
    (
      selector: (s: { sessionId: string | null; courseId: string | null }) => unknown,
    ) => selector({ sessionId: mockSessionId, courseId: mockCourseId }),
  ),
}));

// ── Mock position queue ───────────────────────────────────────────

const mockEnqueue = vi.fn().mockResolvedValue(undefined);
const mockDrainAll = vi.fn().mockResolvedValue([]);
const mockClearQueue = vi.fn().mockResolvedValue(undefined);

vi.mock("../../services/position-queue", () => ({
  enqueuePosition: (...args: unknown[]) => mockEnqueue(...args),
  drainAll: () => mockDrainAll(),
  clearQueue: () => mockClearQueue(),
}));

// ── Mock api-client ───────────────────────────────────────────────

const mockPost = vi.fn().mockResolvedValue(undefined);

vi.mock("../../services/api-client", () => ({
  apiClient: {
    post: (...args: unknown[]) => mockPost(...args),
  },
}));

// ── Mock constants ────────────────────────────────────────────────

vi.mock("../../lib/constants", () => ({
  WS_URL: "wss://test.api",
}));

const { useSocket } = await import("../use-socket");

// ── Tests ─────────────────────────────────────────────────────────

const defaultPosition: GpsPosition = { lat: 44.885, lng: -0.564, accuracy: 5 };

describe("useSocket", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    handlers.clear();
    mockClient.connected = false;
    mockAccessToken = "test-token";
    mockSessionId = "session-1";
    mockCourseId = "course-1";
    mockDrainAll.mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("does not connect when sessionId is null", () => {
    mockSessionId = null;
    renderHook(() => useSocket(defaultPosition));
    expect(mockClient.connect).not.toHaveBeenCalled();
  });

  it("does not connect when courseId is null", () => {
    mockCourseId = null;
    renderHook(() => useSocket(defaultPosition));
    expect(mockClient.connect).not.toHaveBeenCalled();
  });

  it("does not connect when accessToken is null", () => {
    mockAccessToken = null;
    renderHook(() => useSocket(defaultPosition));
    expect(mockClient.connect).not.toHaveBeenCalled();
  });

  it("connects when sessionId, courseId, and token are provided", () => {
    renderHook(() => useSocket(defaultPosition));

    expect(mockClient.connect).toHaveBeenCalledWith({
      url: "wss://test.api",
      token: "test-token",
    });
  });

  it("joins room and sets connected on connect event", () => {
    const { result } = renderHook(() => useSocket(defaultPosition));

    expect(result.current.connected).toBe(false);

    act(() => {
      mockClient.connected = true;
      handlers.get("connect")?.();
    });

    expect(result.current.connected).toBe(true);
    expect(mockClient.joinRoom).toHaveBeenCalledWith("course-1");
  });

  it("enqueues position and sends via WS on interval tick", async () => {
    renderHook(() => useSocket(defaultPosition));

    act(() => {
      mockClient.connected = true;
      handlers.get("connect")?.();
    });

    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    expect(mockEnqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: "session-1",
        lat: 44.885,
        lng: -0.564,
        accuracy: 5,
      }),
    );
    expect(mockClient.sendPosition).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: "session-1",
        lat: 44.885,
        lng: -0.564,
      }),
    );
  });

  it("does not send position when position is null", async () => {
    renderHook(() => useSocket(null));

    act(() => {
      mockClient.connected = true;
      handlers.get("connect")?.();
    });

    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    expect(mockEnqueue).not.toHaveBeenCalled();
    expect(mockClient.sendPosition).not.toHaveBeenCalled();
  });

  it("drains offline queue on connect", async () => {
    const pending = [
      { sessionId: "session-1", lat: 48.8, lng: 2.3, accuracy: 5, recordedAt: "2026-02-19T10:00:00Z" },
    ];
    mockDrainAll.mockResolvedValueOnce(pending);

    renderHook(() => useSocket(defaultPosition));

    await act(async () => {
      mockClient.connected = true;
      handlers.get("connect")?.();
    });

    expect(mockDrainAll).toHaveBeenCalled();
    expect(mockPost).toHaveBeenCalledWith("/positions/batch", {
      sessionId: "session-1",
      positions: [{ lat: 48.8, lng: 2.3, accuracy: 5, recordedAt: "2026-02-19T10:00:00Z" }],
    });
    expect(mockClearQueue).toHaveBeenCalled();
  });

  it("clears interval on disconnect", async () => {
    renderHook(() => useSocket(defaultPosition));

    act(() => {
      mockClient.connected = true;
      handlers.get("connect")?.();
    });

    act(() => {
      mockClient.connected = false;
      handlers.get("disconnect")?.();
    });

    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    // Should not enqueue after disconnect
    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  it("sets error on error event", () => {
    const { result } = renderHook(() => useSocket(defaultPosition));

    act(() => {
      handlers.get("error")?.({ message: "Session not found" });
    });

    expect(result.current.error).toBe("Session not found");
  });

  it("cleans up on unmount", () => {
    const { unmount } = renderHook(() => useSocket(defaultPosition));

    unmount();

    expect(mockClient.leaveRoom).toHaveBeenCalledWith("course-1");
    expect(mockClient.destroy).toHaveBeenCalled();
  });
});
