import { create } from "zustand";
import { apiClient } from "@/services/api-client";
import type { RoundWithScoresResponse, ScoreResponse } from "@golfix/shared";

export interface LocalScore {
  strokes: number;
  putts: number;
  fairwayHit: boolean | null;
  greenInRegulation: boolean | null;
  synced: boolean;
}

interface RoundState {
  roundId: string | null;
  courseId: string | null;
  currentHole: number;
  scores: Map<number, LocalScore>;
  saving: boolean;
  error: string | null;
}

interface RoundActions {
  startRound: (courseId: string, pars: number[]) => void;
  setStrokes: (hole: number, strokes: number) => void;
  setPutts: (hole: number, putts: number) => void;
  toggleFairwayHit: (hole: number) => void;
  toggleGir: (hole: number) => void;
  setCurrentHole: (hole: number) => void;
  saveScore: (hole: number) => Promise<void>;
  loadRound: (roundId: string) => Promise<void>;
  reset: () => void;
}

const initialState: RoundState = {
  roundId: null,
  courseId: null,
  currentHole: 1,
  scores: new Map(),
  saving: false,
  error: null,
};

function toggleTriState(current: boolean | null): boolean | null {
  if (current === null) return true;
  if (current === true) return false;
  return null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export const useRoundStore = create<RoundState & RoundActions>()((set, get) => ({
  ...initialState,

  startRound: (courseId, pars) => {
    const scores = new Map<number, LocalScore>();
    for (let i = 0; i < pars.length; i++) {
      scores.set(i + 1, {
        strokes: pars[i]!,
        putts: 0,
        fairwayHit: null,
        greenInRegulation: null,
        synced: false,
      });
    }
    set({ courseId, currentHole: 1, scores, roundId: null, error: null });
  },

  setStrokes: (hole, strokes) => {
    const scores = new Map(get().scores);
    const existing = scores.get(hole);
    if (!existing) return;
    scores.set(hole, { ...existing, strokes: clamp(strokes, 1, 20), synced: false });
    set({ scores });
  },

  setPutts: (hole, putts) => {
    const scores = new Map(get().scores);
    const existing = scores.get(hole);
    if (!existing) return;
    scores.set(hole, { ...existing, putts: clamp(putts, 0, 10), synced: false });
    set({ scores });
  },

  toggleFairwayHit: (hole) => {
    const scores = new Map(get().scores);
    const existing = scores.get(hole);
    if (!existing) return;
    scores.set(hole, {
      ...existing,
      fairwayHit: toggleTriState(existing.fairwayHit),
      synced: false,
    });
    set({ scores });
  },

  toggleGir: (hole) => {
    const scores = new Map(get().scores);
    const existing = scores.get(hole);
    if (!existing) return;
    scores.set(hole, {
      ...existing,
      greenInRegulation: toggleTriState(existing.greenInRegulation),
      synced: false,
    });
    set({ scores });
  },

  setCurrentHole: (hole) => {
    const totalHoles = get().scores.size;
    set({ currentHole: clamp(hole, 1, totalHoles || 18) });
  },

  saveScore: async (hole) => {
    const state = get();
    if (state.saving) return;
    const score = state.scores.get(hole);
    if (!score) return;

    set({ saving: true, error: null });

    try {
      let { roundId } = state;

      // Lazy round creation on first save
      if (!roundId) {
        const round = await apiClient.post<RoundWithScoresResponse>("/rounds", {
          courseId: state.courseId,
        });
        roundId = round.id;
        set({ roundId });
      }

      await apiClient.put<ScoreResponse>(`/rounds/${roundId}/scores`, {
        holeNumber: hole,
        strokes: score.strokes,
        putts: score.putts,
        fairwayHit: score.fairwayHit,
        greenInRegulation: score.greenInRegulation,
      });

      // Mark as synced
      const scores = new Map(get().scores);
      const current = scores.get(hole);
      if (current) {
        scores.set(hole, { ...current, synced: true });
        set({ scores, saving: false });
      } else {
        set({ saving: false });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sauvegarde échouée";
      set({ saving: false, error: message });
    }
  },

  loadRound: async (roundId) => {
    set({ saving: true, error: null });

    try {
      const round = await apiClient.get<RoundWithScoresResponse>(`/rounds/${roundId}`);
      const scores = new Map<number, LocalScore>();

      for (const s of round.scores) {
        scores.set(s.holeNumber, {
          strokes: s.strokes,
          putts: s.putts ?? 0,
          fairwayHit: s.fairwayHit,
          greenInRegulation: s.greenInRegulation,
          synced: true,
        });
      }

      set({ roundId, courseId: round.courseId, scores, saving: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Chargement échoué";
      set({ saving: false, error: message });
    }
  },

  reset: () => set({ ...initialState, scores: new Map() }),
}));
