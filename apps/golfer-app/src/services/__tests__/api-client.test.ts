import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import { apiClient, ApiError } from "../api-client";
import { useAuthStore } from "@/stores/auth-store";

beforeEach(() => {
  useAuthStore.getState().reset();
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function mockFetchOk(data: unknown = {}) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve(data),
  });
}

describe("apiClient", () => {
  test("makes GET request to correct URL", async () => {
    const mock = mockFetchOk({ data: "test" });
    vi.stubGlobal("fetch", mock);

    await apiClient.get("/courses");

    expect(mock).toHaveBeenCalledWith(
      "/api/v1/courses",
      expect.objectContaining({ method: "GET" }),
    );
  });

  test("includes auth header when token exists", async () => {
    useAuthStore.getState().setAuth({
      user: { id: "u1", displayName: "Test", email: null },
      accessToken: "my-token",
      refreshToken: "rt",
    });

    const mock = mockFetchOk();
    vi.stubGlobal("fetch", mock);

    await apiClient.get("/courses");

    const headers = mock.mock.calls[0]![1].headers;
    expect(headers["Authorization"]).toBe("Bearer my-token");
  });

  test("makes POST request with JSON body", async () => {
    const mock = mockFetchOk({ id: "123" });
    vi.stubGlobal("fetch", mock);

    await apiClient.post("/auth/login", { email: "t@t.com", password: "pass" });

    const call = mock.mock.calls[0]!;
    expect(call[1].method).toBe("POST");
    expect(call[1].body).toBe(JSON.stringify({ email: "t@t.com", password: "pass" }));
  });

  test("throws ApiError on non-ok response", async () => {
    const mock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: "Invalid credentials", statusCode: 401 }),
    });
    vi.stubGlobal("fetch", mock);

    await expect(apiClient.post("/auth/login", {})).rejects.toThrow("Invalid credentials");
  });
});

describe("token refresh interceptor", () => {
  test("retries request after successful refresh", async () => {
    useAuthStore.getState().setAuth({
      user: { id: "u1", displayName: "Test", email: null },
      accessToken: "expired-token",
      refreshToken: "valid-rt",
    });

    let callCount = 0;
    const mock = vi.fn().mockImplementation((url: string) => {
      callCount++;
      // First call: 401 on original request
      if (callCount === 1) {
        return Promise.resolve({
          ok: false,
          status: 401,
          json: () => Promise.resolve({ error: "Token expired", statusCode: 401 }),
        });
      }
      // Second call: refresh endpoint
      if (callCount === 2 && url.includes("/auth/refresh")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ accessToken: "new-at", refreshToken: "new-rt" }),
        });
      }
      // Third call: retried original request
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: "success" }),
      });
    });
    vi.stubGlobal("fetch", mock);

    const result = await apiClient.get<{ data: string }>("/courses");

    expect(result.data).toBe("success");
    expect(mock).toHaveBeenCalledTimes(3);
  });

  test("calls updateTokens after successful refresh", async () => {
    useAuthStore.getState().setAuth({
      user: { id: "u1", displayName: "Test", email: null },
      accessToken: "expired-token",
      refreshToken: "valid-rt",
    });

    let callCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: false,
            status: 401,
            json: () => Promise.resolve({ error: "expired" }),
          });
        }
        if (callCount === 2 && url.includes("/auth/refresh")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ accessToken: "new-at", refreshToken: "new-rt" }),
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({}),
        });
      }),
    );

    await apiClient.get("/courses");

    expect(useAuthStore.getState().accessToken).toBe("new-at");
    expect(useAuthStore.getState().refreshToken).toBe("new-rt");
  });

  test("calls logout on refresh failure", async () => {
    useAuthStore.getState().setAuth({
      user: { id: "u1", displayName: "Test", email: null },
      accessToken: "expired-token",
      refreshToken: "valid-rt",
    });

    let callCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: false,
            status: 401,
            json: () => Promise.resolve({ error: "expired" }),
          });
        }
        // refresh fails
        return Promise.resolve({
          ok: false,
          status: 401,
          json: () => Promise.resolve({ error: "Refresh token invalid" }),
        });
      }),
    );

    await expect(apiClient.get("/courses")).rejects.toThrow("Session expired");
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
  });

  test("deduplicates concurrent refresh calls", async () => {
    useAuthStore.getState().setAuth({
      user: { id: "u1", displayName: "Test", email: null },
      accessToken: "expired-token",
      refreshToken: "valid-rt",
    });

    let refreshCallCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("/auth/refresh")) {
          refreshCallCount++;
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ accessToken: "new-at", refreshToken: "new-rt" }),
          });
        }
        // First two calls return 401, subsequent calls succeed
        if (useAuthStore.getState().accessToken === "expired-token") {
          return Promise.resolve({
            ok: false,
            status: 401,
            json: () => Promise.resolve({ error: "expired" }),
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ data: "ok" }),
        });
      }),
    );

    // Fire two requests concurrently
    const [r1, r2] = await Promise.all([apiClient.get("/courses"), apiClient.get("/sessions")]);

    expect(r1).toEqual({ data: "ok" });
    expect(r2).toEqual({ data: "ok" });
    // Only one refresh call should have been made
    expect(refreshCallCount).toBe(1);
  });

  test("does not attempt refresh without refreshToken", async () => {
    useAuthStore.getState().setAuth({
      user: { id: "u1", displayName: "Test", email: null },
      accessToken: "expired-token",
      refreshToken: null as unknown as string,
    });
    // Clear refreshToken
    useAuthStore.setState({ refreshToken: null });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: "Unauthorized", statusCode: 401 }),
      }),
    );

    try {
      await apiClient.get("/courses");
      expect.fail("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).status).toBe(401);
      expect((err as ApiError).message).toBe("Unauthorized");
    }
  });
});
