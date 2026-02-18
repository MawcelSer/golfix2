// ── Request types ──────────────────────────────────────────────────

export interface StartSessionInput {
  courseId: string;
}

export interface FinishSessionInput {
  status: "finished" | "abandoned";
}

// ── Response types ─────────────────────────────────────────────────

export interface StartSessionResponse {
  sessionId: string;
  groupId: string;
  courseId: string;
}

export interface SessionResponse {
  id: string;
  userId: string;
  courseId: string;
  groupId: string | null;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  currentHole: number | null;
}
