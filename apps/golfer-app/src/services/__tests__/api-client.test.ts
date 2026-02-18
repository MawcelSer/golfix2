import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import { apiClient } from "../api-client";
import { useAuthStore } from "@/stores/auth-store";

beforeEach(() => {
  useAuthStore.getState().reset();
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("apiClient", () => {
  test("makes GET request to correct URL", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: "test" }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await apiClient.get("/courses");

    expect(mockFetch).toHaveBeenCalledWith(
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

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
    vi.stubGlobal("fetch", mockFetch);

    await apiClient.get("/courses");

    const headers = mockFetch.mock.calls[0]![1].headers;
    expect(headers["Authorization"]).toBe("Bearer my-token");
  });

  test("makes POST request with JSON body", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: "123" }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await apiClient.post("/auth/login", { email: "t@t.com", password: "pass" });

    const call = mockFetch.mock.calls[0]!;
    expect(call[1].method).toBe("POST");
    expect(call[1].body).toBe(JSON.stringify({ email: "t@t.com", password: "pass" }));
  });

  test("throws ApiError on non-ok response", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: "Invalid credentials", statusCode: 401 }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await expect(apiClient.post("/auth/login", {})).rejects.toThrow("Invalid credentials");
  });
});
