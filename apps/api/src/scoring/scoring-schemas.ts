import { z } from "zod";

// ── Request schemas ─────────────────────────────────────────────────

export const createRoundSchema = z.object({
  courseId: z.string().uuid(),
  sessionId: z.string().uuid().optional(),
});

export const upsertScoreSchema = z.object({
  holeNumber: z.number().int().min(1).max(18),
  strokes: z.number().int().min(1).max(20),
  putts: z.number().int().min(0).max(10).optional(),
  fairwayHit: z.boolean().optional(),
  greenInRegulation: z.boolean().optional(),
});

// ── Inferred types ──────────────────────────────────────────────────

export type CreateRoundInput = z.infer<typeof createRoundSchema>;
export type UpsertScoreInput = z.infer<typeof upsertScoreSchema>;

// ── Response types ──────────────────────────────────────────────────

export interface ScoreResponse {
  id: string;
  roundId: string;
  holeNumber: number;
  strokes: number;
  putts: number | null;
  fairwayHit: boolean | null;
  greenInRegulation: boolean | null;
}

export interface RoundResponse {
  id: string;
  userId: string;
  courseId: string;
  sessionId: string | null;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  totalScore: number | null;
  totalPutts: number | null;
}

export interface RoundWithScoresResponse extends RoundResponse {
  scores: ScoreResponse[];
}

export interface RoundSummaryResponse extends RoundResponse {
  computedTotalStrokes: number;
}
