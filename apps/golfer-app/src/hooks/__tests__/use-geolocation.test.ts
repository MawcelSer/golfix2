import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useGeolocation } from "../use-geolocation";

let mockWatchId = 1;
let watchCallbacks: Map<number, { success: PositionCallback; error: PositionErrorCallback }>;

beforeEach(() => {
  watchCallbacks = new Map();
  mockWatchId = 1;

  const mockGeolocation = {
    watchPosition: vi.fn((success: PositionCallback, error: PositionErrorCallback) => {
      const id = mockWatchId++;
      watchCallbacks.set(id, { success, error });
      return id;
    }),
    clearWatch: vi.fn(),
    getCurrentPosition: vi.fn(),
  };

  vi.stubGlobal("navigator", { geolocation: mockGeolocation });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function simulatePosition(lat: number, lng: number, accuracy: number) {
  for (const [, cb] of watchCallbacks) {
    cb.success({
      coords: {
        latitude: lat,
        longitude: lng,
        accuracy,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
      },
      timestamp: Date.now(),
    } as GeolocationPosition);
  }
}

function simulateError(code: number, message: string) {
  for (const [, cb] of watchCallbacks) {
    cb.error({ code, message, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 });
  }
}

describe("useGeolocation", () => {
  test("starts with null position and not watching", () => {
    const { result } = renderHook(() => useGeolocation());
    expect(result.current.position).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.watching).toBe(false);
  });

  test("startWatching begins geolocation watch", () => {
    const { result } = renderHook(() => useGeolocation());

    act(() => {
      result.current.startWatching();
    });

    expect(result.current.watching).toBe(true);
    expect(navigator.geolocation.watchPosition).toHaveBeenCalled();
  });

  test("updates position on GPS callback", () => {
    const { result } = renderHook(() => useGeolocation());

    act(() => {
      result.current.startWatching();
    });

    act(() => {
      simulatePosition(48.8566, 2.3522, 10);
    });

    expect(result.current.position).toEqual({
      lat: 48.8566,
      lng: 2.3522,
      accuracy: 10,
    });
  });

  test("sets error on permission denied", () => {
    const { result } = renderHook(() => useGeolocation());

    act(() => {
      result.current.startWatching();
    });

    act(() => {
      simulateError(1, "User denied Geolocation");
    });

    expect(result.current.error).toBe("permission_denied");
  });

  test("stopWatching clears the watch", () => {
    const { result } = renderHook(() => useGeolocation());

    act(() => {
      result.current.startWatching();
    });

    act(() => {
      result.current.stopWatching();
    });

    expect(result.current.watching).toBe(false);
    expect(navigator.geolocation.clearWatch).toHaveBeenCalled();
  });
});
