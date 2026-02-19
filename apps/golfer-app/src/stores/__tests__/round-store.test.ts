import { describe, it, expect, vi, beforeEach } from "vitest";
import type { RoundWithScoresResponse, ScoreResponse } from "@golfix/shared";

// Mock api-client before importing store
vi.mock("@/services/api-client", () => ({
  apiClient: {
    post: vi.fn(),
    put: vi.fn(),
    get: vi.fn(),
  },
}));

const { useRoundStore } = await import("../round-store");
const { apiClient } = await import("@/services/api-client");

const mockPost = vi.mocked(apiClient.post);
const mockPut = vi.mocked(apiClient.put);
const mockGet = vi.mocked(apiClient.get);

const pars = [4, 3, 5, 4];

describe("round-store", () => {
  beforeEach(() => {
    useRoundStore.getState().reset();
    vi.clearAllMocks();
  });

  describe("startRound", () => {
    it("initializes scores with par defaults", () => {
      useRoundStore.getState().startRound("c1", pars);

      const state = useRoundStore.getState();
      expect(state.courseId).toBe("c1");
      expect(state.currentHole).toBe(1);
      expect(state.roundId).toBeNull();
      expect(state.scores.size).toBe(4);
      expect(state.scores.get(1)?.strokes).toBe(4);
      expect(state.scores.get(2)?.strokes).toBe(3);
      expect(state.scores.get(3)?.strokes).toBe(5);
      expect(state.scores.get(1)?.synced).toBe(false);
    });
  });

  describe("setStrokes", () => {
    it("updates strokes for a hole", () => {
      useRoundStore.getState().startRound("c1", pars);
      useRoundStore.getState().setStrokes(1, 6);

      expect(useRoundStore.getState().scores.get(1)?.strokes).toBe(6);
      expect(useRoundStore.getState().scores.get(1)?.synced).toBe(false);
    });

    it("clamps strokes to 1-20", () => {
      useRoundStore.getState().startRound("c1", pars);

      useRoundStore.getState().setStrokes(1, 0);
      expect(useRoundStore.getState().scores.get(1)?.strokes).toBe(1);

      useRoundStore.getState().setStrokes(1, 25);
      expect(useRoundStore.getState().scores.get(1)?.strokes).toBe(20);
    });

    it("does nothing for non-existent hole", () => {
      useRoundStore.getState().startRound("c1", pars);
      useRoundStore.getState().setStrokes(99, 5);

      expect(useRoundStore.getState().scores.size).toBe(4);
    });
  });

  describe("setPutts", () => {
    it("updates putts for a hole", () => {
      useRoundStore.getState().startRound("c1", pars);
      useRoundStore.getState().setPutts(1, 2);

      expect(useRoundStore.getState().scores.get(1)?.putts).toBe(2);
    });

    it("clamps putts to 0-10", () => {
      useRoundStore.getState().startRound("c1", pars);

      useRoundStore.getState().setPutts(1, -1);
      expect(useRoundStore.getState().scores.get(1)?.putts).toBe(0);

      useRoundStore.getState().setPutts(1, 15);
      expect(useRoundStore.getState().scores.get(1)?.putts).toBe(10);
    });
  });

  describe("toggleFairwayHit", () => {
    it("cycles null → true → false → null", () => {
      useRoundStore.getState().startRound("c1", pars);

      expect(useRoundStore.getState().scores.get(1)?.fairwayHit).toBeNull();

      useRoundStore.getState().toggleFairwayHit(1);
      expect(useRoundStore.getState().scores.get(1)?.fairwayHit).toBe(true);

      useRoundStore.getState().toggleFairwayHit(1);
      expect(useRoundStore.getState().scores.get(1)?.fairwayHit).toBe(false);

      useRoundStore.getState().toggleFairwayHit(1);
      expect(useRoundStore.getState().scores.get(1)?.fairwayHit).toBeNull();
    });
  });

  describe("toggleGir", () => {
    it("cycles null → true → false → null", () => {
      useRoundStore.getState().startRound("c1", pars);

      useRoundStore.getState().toggleGir(1);
      expect(useRoundStore.getState().scores.get(1)?.greenInRegulation).toBe(true);

      useRoundStore.getState().toggleGir(1);
      expect(useRoundStore.getState().scores.get(1)?.greenInRegulation).toBe(false);

      useRoundStore.getState().toggleGir(1);
      expect(useRoundStore.getState().scores.get(1)?.greenInRegulation).toBeNull();
    });
  });

  describe("setCurrentHole", () => {
    it("sets current hole within range", () => {
      useRoundStore.getState().startRound("c1", pars);
      useRoundStore.getState().setCurrentHole(3);

      expect(useRoundStore.getState().currentHole).toBe(3);
    });

    it("clamps to valid range", () => {
      useRoundStore.getState().startRound("c1", pars);

      useRoundStore.getState().setCurrentHole(0);
      expect(useRoundStore.getState().currentHole).toBe(1);

      useRoundStore.getState().setCurrentHole(99);
      expect(useRoundStore.getState().currentHole).toBe(4);
    });
  });

  describe("saveScore", () => {
    it("creates round on first save then upserts score", async () => {
      const mockRound: RoundWithScoresResponse = {
        id: "r1",
        userId: "u1",
        courseId: "c1",
        sessionId: null,
        status: "in_progress",
        startedAt: "2026-02-19T10:00:00Z",
        finishedAt: null,
        totalScore: null,
        totalPutts: null,
        scores: [],
      };
      const mockScore: ScoreResponse = {
        id: "s1",
        roundId: "r1",
        holeNumber: 1,
        strokes: 4,
        putts: 0,
        fairwayHit: null,
        greenInRegulation: null,
      };

      mockPost.mockResolvedValueOnce(mockRound);
      mockPut.mockResolvedValueOnce(mockScore);

      useRoundStore.getState().startRound("c1", pars);
      await useRoundStore.getState().saveScore(1);

      expect(mockPost).toHaveBeenCalledWith("/rounds", { courseId: "c1" });
      expect(mockPut).toHaveBeenCalledWith("/rounds/r1/scores", {
        holeNumber: 1,
        strokes: 4,
        putts: 0,
        fairwayHit: null,
        greenInRegulation: null,
      });
      expect(useRoundStore.getState().roundId).toBe("r1");
      expect(useRoundStore.getState().scores.get(1)?.synced).toBe(true);
      expect(useRoundStore.getState().saving).toBe(false);
    });

    it("reuses existing round id on subsequent saves", async () => {
      const mockScore: ScoreResponse = {
        id: "s2",
        roundId: "r1",
        holeNumber: 2,
        strokes: 3,
        putts: 0,
        fairwayHit: null,
        greenInRegulation: null,
      };
      mockPut.mockResolvedValueOnce(mockScore);

      useRoundStore.getState().startRound("c1", pars);
      useRoundStore.setState({ roundId: "r1" });
      await useRoundStore.getState().saveScore(2);

      expect(mockPost).not.toHaveBeenCalled();
      expect(mockPut).toHaveBeenCalledWith("/rounds/r1/scores", expect.any(Object));
    });

    it("sets error on failure", async () => {
      mockPost.mockRejectedValueOnce(new Error("Network error"));

      useRoundStore.getState().startRound("c1", pars);
      await useRoundStore.getState().saveScore(1);

      expect(useRoundStore.getState().error).toBe("Network error");
      expect(useRoundStore.getState().saving).toBe(false);
      expect(useRoundStore.getState().scores.get(1)?.synced).toBe(false);
    });
  });

  describe("loadRound", () => {
    it("hydrates scores from API response", async () => {
      const mockRound: RoundWithScoresResponse = {
        id: "r1",
        userId: "u1",
        courseId: "c1",
        sessionId: null,
        status: "in_progress",
        startedAt: "2026-02-19T10:00:00Z",
        finishedAt: null,
        totalScore: null,
        totalPutts: null,
        scores: [
          {
            id: "s1",
            roundId: "r1",
            holeNumber: 1,
            strokes: 5,
            putts: 2,
            fairwayHit: true,
            greenInRegulation: false,
          },
          {
            id: "s2",
            roundId: "r1",
            holeNumber: 2,
            strokes: 3,
            putts: 1,
            fairwayHit: null,
            greenInRegulation: true,
          },
        ],
      };
      mockGet.mockResolvedValueOnce(mockRound);

      await useRoundStore.getState().loadRound("r1");

      const state = useRoundStore.getState();
      expect(state.roundId).toBe("r1");
      expect(state.courseId).toBe("c1");
      expect(state.scores.get(1)).toEqual({
        strokes: 5,
        putts: 2,
        fairwayHit: true,
        greenInRegulation: false,
        synced: true,
      });
      expect(state.scores.get(2)?.greenInRegulation).toBe(true);
    });

    it("sets error on failure", async () => {
      mockGet.mockRejectedValueOnce(new Error("Not found"));

      await useRoundStore.getState().loadRound("r1");

      expect(useRoundStore.getState().error).toBe("Not found");
    });
  });

  describe("reset", () => {
    it("clears all state", () => {
      useRoundStore.getState().startRound("c1", pars);
      useRoundStore.setState({ roundId: "r1" });
      useRoundStore.getState().reset();

      const state = useRoundStore.getState();
      expect(state.roundId).toBeNull();
      expect(state.courseId).toBeNull();
      expect(state.scores.size).toBe(0);
      expect(state.currentHole).toBe(1);
    });
  });
});
