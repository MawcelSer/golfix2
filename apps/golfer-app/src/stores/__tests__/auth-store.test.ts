import { describe, expect, test, beforeEach } from "vitest";
import { useAuthStore } from "../auth-store";

beforeEach(() => {
  localStorage.clear();
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

  test("persists auth state to localStorage", () => {
    useAuthStore.getState().setAuth({
      user: { id: "u1", displayName: "Test", email: null },
      accessToken: "at",
      refreshToken: "rt",
    });
    useAuthStore.getState().acceptGdpr();

    const stored = JSON.parse(localStorage.getItem("golfix-auth")!);
    expect(stored.state.accessToken).toBe("at");
    expect(stored.state.refreshToken).toBe("rt");
    expect(stored.state.user.id).toBe("u1");
    expect(stored.state.gdprConsent).toBe(true);
  });

  test("restores auth state from localStorage", () => {
    const persisted = {
      state: {
        accessToken: "restored-at",
        refreshToken: "restored-rt",
        user: { id: "u2", displayName: "Restored", email: null },
        gdprConsent: true,
        gdprConsentAt: 1000000,
      },
      version: 0,
    };
    localStorage.setItem("golfix-auth", JSON.stringify(persisted));

    // Trigger rehydration
    useAuthStore.persist.rehydrate();

    const state = useAuthStore.getState();
    expect(state.accessToken).toBe("restored-at");
    expect(state.refreshToken).toBe("restored-rt");
    expect(state.user?.id).toBe("u2");
    expect(state.gdprConsent).toBe(true);
  });

  test("logout clears tokens but keeps gdprConsent in storage", () => {
    useAuthStore.getState().setAuth({
      user: { id: "u1", displayName: "Test", email: null },
      accessToken: "at",
      refreshToken: "rt",
    });
    useAuthStore.getState().acceptGdpr();
    useAuthStore.getState().logout();

    const stored = JSON.parse(localStorage.getItem("golfix-auth")!);
    expect(stored.state.accessToken).toBeNull();
    expect(stored.state.refreshToken).toBeNull();
    expect(stored.state.gdprConsent).toBe(true);
  });
});
