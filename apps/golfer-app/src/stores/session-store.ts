import { create } from "zustand";
import { apiClient } from "@/services/api-client";
import type { StartSessionResponse, SessionResponse } from "@golfix/shared";

type SessionStatus = "idle" | "active" | "finishing" | "ended";

interface SessionState {
  sessionId: string | null;
  courseId: string | null;
  status: SessionStatus;
  error: string | null;
}

interface SessionActions {
  startSession: (courseId: string) => Promise<void>;
  finishSession: (status: "finished" | "abandoned") => Promise<void>;
  reset: () => void;
}

const initialState: SessionState = {
  sessionId: null,
  courseId: null,
  status: "idle",
  error: null,
};

export const useSessionStore = create<SessionState & SessionActions>()((set, get) => ({
  ...initialState,

  startSession: async (courseId) => {
    if (get().status === "active") return;

    set({ status: "idle", error: null });

    try {
      const result = await apiClient.post<StartSessionResponse>("/sessions/start", { courseId });
      set({ sessionId: result.sessionId, courseId, status: "active", error: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Impossible de démarrer la session";
      set({ status: "idle", error: message });
    }
  },

  finishSession: async (status) => {
    const { sessionId, status: currentStatus } = get();
    if (currentStatus !== "active" || !sessionId) return;

    set({ status: "finishing", error: null });

    try {
      await apiClient.patch<SessionResponse>(`/sessions/${sessionId}/finish`, { status });
      set({ status: "ended" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Impossible de terminer la session";
      set({ status: "active", error: message });
    }
  },

  reset: () => set({ ...initialState }),
}));
