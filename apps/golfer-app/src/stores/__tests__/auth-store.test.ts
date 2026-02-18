import { describe, expect, test, beforeEach } from "vitest";
import { useAuthStore } from "../auth-store";

beforeEach(() => {
  useAuthStore.getState().reset();
});

describe("authStore", () => {
  test("starts with no user and no consent", () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.accessToken).toBeNull();
    expect(state.refreshToken).toBeNull();
    expect(state.gdprConsent).toBe(false);
    expect(state.gdprConsentAt).toBeNull();
  });

  test("setAuth stores user and tokens", () => {
    useAuthStore.getState().setAuth({
      user: { id: "u1", displayName: "Test", email: "t@t.com" },
      accessToken: "at",
      refreshToken: "rt",
    });

    const state = useAuthStore.getState();
    expect(state.user).toEqual({ id: "u1", displayName: "Test", email: "t@t.com" });
    expect(state.accessToken).toBe("at");
    expect(state.refreshToken).toBe("rt");
  });

  test("acceptGdpr sets consent to true and records timestamp", () => {
    const before = Date.now();
    useAuthStore.getState().acceptGdpr();
    const state = useAuthStore.getState();

    expect(state.gdprConsent).toBe(true);
    expect(state.gdprConsentAt).not.toBeNull();
    expect(state.gdprConsentAt!).toBeGreaterThanOrEqual(before);
    expect(state.gdprConsentAt!).toBeLessThanOrEqual(Date.now());
  });

  test("revokeGdpr sets consent back to false and clears timestamp", () => {
    useAuthStore.getState().acceptGdpr();
    useAuthStore.getState().revokeGdpr();

    const state = useAuthStore.getState();
    expect(state.gdprConsent).toBe(false);
    expect(state.gdprConsentAt).toBeNull();
  });

  test("logout clears all auth state", () => {
    useAuthStore.getState().setAuth({
      user: { id: "u1", displayName: "Test", email: null },
      accessToken: "at",
      refreshToken: "rt",
    });
    useAuthStore.getState().acceptGdpr();
    useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.accessToken).toBeNull();
    expect(state.refreshToken).toBeNull();
    // GDPR consent persists across logout
    expect(state.gdprConsent).toBe(true);
  });

  test("updateTokens replaces tokens", () => {
    useAuthStore.getState().setAuth({
      user: { id: "u1", displayName: "Test", email: null },
      accessToken: "old-at",
      refreshToken: "old-rt",
    });
    useAuthStore.getState().updateTokens({ accessToken: "new-at", refreshToken: "new-rt" });

    const state = useAuthStore.getState();
    expect(state.accessToken).toBe("new-at");
    expect(state.refreshToken).toBe("new-rt");
  });
});
