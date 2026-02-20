import { describe, it, expect, beforeEach } from "vitest";
import { useAuthStore } from "../auth-store";

describe("auth-store (dashboard)", () => {
  beforeEach(() => {
    useAuthStore.getState().logout();
  });

  it("starts with null user and tokens", () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.accessToken).toBeNull();
    expect(state.refreshToken).toBeNull();
  });

  it("setAuth stores user and tokens", () => {
    useAuthStore.getState().setAuth({
      user: { id: "u1", displayName: "Manager", email: "m@test.com" },
      accessToken: "at",
      refreshToken: "rt",
    });

    const state = useAuthStore.getState();
    expect(state.user?.id).toBe("u1");
    expect(state.accessToken).toBe("at");
    expect(state.refreshToken).toBe("rt");
  });

  it("updateTokens updates only tokens", () => {
    useAuthStore.getState().setAuth({
      user: { id: "u1", displayName: "Manager", email: "m@test.com" },
      accessToken: "old-at",
      refreshToken: "old-rt",
    });

    useAuthStore.getState().updateTokens({
      accessToken: "new-at",
      refreshToken: "new-rt",
    });

    const state = useAuthStore.getState();
    expect(state.user?.id).toBe("u1");
    expect(state.accessToken).toBe("new-at");
    expect(state.refreshToken).toBe("new-rt");
  });

  it("logout clears all state", () => {
    useAuthStore.getState().setAuth({
      user: { id: "u1", displayName: "Manager", email: "m@test.com" },
      accessToken: "at",
      refreshToken: "rt",
    });

    useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.accessToken).toBeNull();
    expect(state.refreshToken).toBeNull();
  });
});
