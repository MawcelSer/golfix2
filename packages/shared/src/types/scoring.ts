// ── Request types ──────────────────────────────────────────────────

export interface CreateRoundInput {
  courseId: string;
  sessionId?: string;
}

export interface UpsertScoreInput {
  holeNumber: number;
  strokes: number;
  putts?: number;
  fairwayHit?: boolean;
  greenInRegulation?: boolean;
}

// ── Response types ─────────────────────────────────────────────────

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
