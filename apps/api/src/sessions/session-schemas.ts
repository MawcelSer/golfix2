import { z } from "zod";

// ── Request schemas ─────────────────────────────────────────────────

export const startSessionSchema = z.object({
  courseId: z.string().uuid(),
});

export const finishSessionSchema = z.object({
  status: z.enum(["finished", "abandoned"]),
});

// ── Inferred types ──────────────────────────────────────────────────

export type StartSessionInput = z.infer<typeof startSessionSchema>;
export type FinishSessionInput = z.infer<typeof finishSessionSchema>;

// ── Response types ──────────────────────────────────────────────────

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
