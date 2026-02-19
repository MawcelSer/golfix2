import { describe, it, expect, vi, beforeEach } from "vitest";
import type { StartSessionResponse } from "@golfix/shared";

vi.mock("@/services/api-client", () => ({
  apiClient: {
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

const { useSessionStore } = await import("../session-store");
const { apiClient } = await import("@/services/api-client");

const mockPost = vi.mocked(apiClient.post);
const mockPatch = vi.mocked((apiClient as Record<string, unknown>).patch as typeof apiClient.post);

describe("session-store", () => {
  beforeEach(() => {
    useSessionStore.getState().reset();
    vi.clearAllMocks();
  });

  it("starts in idle state", () => {
    const state = useSessionStore.getState();
    expect(state.sessionId).toBeNull();
    expect(state.status).toBe("idle");
  });

  describe("startSession", () => {
    it("creates session via API and sets active state", async () => {
      const response: StartSessionResponse = {
        sessionId: "s1",
        groupId: "g1",
        courseId: "c1",
      };
      mockPost.mockResolvedValueOnce(response);

      await useSessionStore.getState().startSession("c1");

      const state = useSessionStore.getState();
      expect(state.sessionId).toBe("s1");
      expect(state.courseId).toBe("c1");
      expect(state.status).toBe("active");
      expect(state.error).toBeNull();
      expect(mockPost).toHaveBeenCalledWith("/sessions/start", { courseId: "c1" });
    });

    it("sets error on API failure", async () => {
      mockPost.mockRejectedValueOnce(new Error("Network error"));

      await useSessionStore.getState().startSession("c1");

      expect(useSessionStore.getState().status).toBe("idle");
      expect(useSessionStore.getState().error).toBe("Network error");
    });

    it("prevents starting when already active", async () => {
      useSessionStore.setState({ status: "active", sessionId: "s1" });

      await useSessionStore.getState().startSession("c1");

      expect(mockPost).not.toHaveBeenCalled();
    });

    it("prevents starting when status is 'starting'", async () => {
      useSessionStore.setState({ status: "starting" });

      await useSessionStore.getState().startSession("c1");

      expect(mockPost).not.toHaveBeenCalled();
    });
  });

  describe("finishSession", () => {
    it("finishes session via API and sets ended state", async () => {
      mockPatch.mockResolvedValueOnce({
        id: "s1",
        userId: "u1",
        courseId: "c1",
        groupId: "g1",
        status: "finished",
        startedAt: "2026-02-19T10:00:00Z",
        finishedAt: "2026-02-19T14:00:00Z",
        currentHole: 18,
      });

      useSessionStore.setState({ status: "active", sessionId: "s1", courseId: "c1" });
      await useSessionStore.getState().finishSession("finished");

      expect(useSessionStore.getState().status).toBe("ended");
      expect(mockPatch).toHaveBeenCalledWith("/sessions/s1/finish", { status: "finished" });
    });

    it("sets error on API failure", async () => {
      mockPatch.mockRejectedValueOnce(new Error("Server error"));

      useSessionStore.setState({ status: "active", sessionId: "s1" });
      await useSessionStore.getState().finishSession("finished");

      expect(useSessionStore.getState().status).toBe("active");
      expect(useSessionStore.getState().error).toBe("Server error");
    });

    it("does nothing when no active session", async () => {
      await useSessionStore.getState().finishSession("finished");
      expect(mockPatch).not.toHaveBeenCalled();
    });
  });

  describe("reset", () => {
    it("clears all state", () => {
      useSessionStore.setState({ sessionId: "s1", status: "active", courseId: "c1" });
      useSessionStore.getState().reset();

      const state = useSessionStore.getState();
      expect(state.sessionId).toBeNull();
      expect(state.status).toBe("idle");
      expect(state.courseId).toBeNull();
    });
  });
});
